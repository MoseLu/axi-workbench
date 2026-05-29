package com.sop.display.geolocation;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "NativeGeolocation",
    permissions = {
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        })
    }
)
public class NativeGeolocationPlugin extends Plugin {

    private static final String TAG = "NativeGeo";
    private static final int GPS_TIMEOUT_MS = 60000;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        Log.i(TAG, "getCurrentPosition called, permission: " + getPermissionState("location"));
        if (getPermissionState("location") != PermissionState.GRANTED) {
            Log.i(TAG, "Requesting location permission...");
            super.requestPermissions(call);
            return;
        }
        doGetLocation(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        Log.i(TAG, "Permission callback, state: " + getPermissionState("location"));
        if (call.isReleased()) return;
        if (getPermissionState("location") == PermissionState.GRANTED) {
            Log.i(TAG, "Permission granted, getting location...");
            doGetLocation(call);
        } else {
            Log.w(TAG, "Permission denied");
            call.reject("Location permission denied");
        }
    }

    private void doGetLocation(PluginCall call) {
        LocationManager locationManager = (LocationManager) getActivity().getSystemService(android.content.Context.LOCATION_SERVICE);
        if (locationManager == null) {
            Log.e(TAG, "LocationManager unavailable");
            call.reject("LocationManager unavailable");
            return;
        }

        boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        Log.i(TAG, "GPS enabled: " + gpsEnabled + ", Network enabled: " + networkEnabled);

        JSObject result = new JSObject();
        Location bestLocation = null;

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location lastNetwork = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            Log.i(TAG, "LastGPS: " + locStr(lastGps));
            Log.i(TAG, "LastNetwork: " + locStr(lastNetwork));
            if (lastGps != null) bestLocation = lastGps;
            if (lastNetwork != null && (bestLocation == null || lastNetwork.getAccuracy() < bestLocation.getAccuracy())) {
                bestLocation = lastNetwork;
            }
        }

        Log.i(TAG, "bestLocation: " + locStr(bestLocation));

        if (bestLocation != null && bestLocation.getAccuracy() < 500) {
            Log.i(TAG, "Using cached location (accuracy < 500m)");
            result.put("latitude", bestLocation.getLatitude());
            result.put("longitude", bestLocation.getLongitude());
            result.put("accuracy", bestLocation.getAccuracy());
            result.put("source", bestLocation.getProvider());
            call.resolve(result);
            return;
        }

        final JSObject finalResult = result;
        Log.i(TAG, "Requesting live location updates...");
        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null) {
                    Log.i(TAG, "Location received: " + location.getLatitude() + "," + location.getLongitude() + " acc:" + location.getAccuracy() + " src:" + location.getProvider());
                    finalResult.put("latitude", location.getLatitude());
                    finalResult.put("longitude", location.getLongitude());
                    finalResult.put("accuracy", location.getAccuracy());
                    finalResult.put("source", location.getProvider());
                    try { locationManager.removeUpdates(this); } catch (Exception ignored) {}
                    call.resolve(finalResult);
                }
            }
            @Override public void onProviderEnabled(String s) { Log.i(TAG, "Provider enabled: " + s); }
            @Override public void onProviderDisabled(String s) { Log.w(TAG, "Provider disabled: " + s); }
            @Override public void onStatusChanged(String s, int i, Bundle bundle) {}
        };

        try {
            if (gpsEnabled && ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, listener, Looper.getMainLooper());
            }
            if (networkEnabled && ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, listener, Looper.getMainLooper());
            }

            final Location finalBestLocation = bestLocation;
            new android.os.Handler(Looper.getMainLooper()).postDelayed(() -> {
                try { locationManager.removeUpdates(listener); } catch (Exception ignored) {}
                if (!call.isReleased()) {
                    if (finalBestLocation != null) {
                        Log.i(TAG, "Timeout, using cached location");
                        finalResult.put("latitude", finalBestLocation.getLatitude());
                        finalResult.put("longitude", finalBestLocation.getLongitude());
                        finalResult.put("accuracy", finalBestLocation.getAccuracy());
                        finalResult.put("source", finalBestLocation.getProvider());
                        call.resolve(finalResult);
                    } else {
                        Log.e(TAG, "Location timeout, no cached location");
                        call.reject("Location timeout");
                    }
                }
            }, GPS_TIMEOUT_MS);
        } catch (Exception e) {
            Log.e(TAG, "GPS request failed: " + e.getMessage());
            call.reject("GPS request failed: " + e.getMessage());
        }
    }

    private static String locStr(Location loc) {
        if (loc == null) return "null";
        return String.format("%.6f,%.6f acc:%.1f", loc.getLatitude(), loc.getLongitude(), loc.getAccuracy());
    }
}
