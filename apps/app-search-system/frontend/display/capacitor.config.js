"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    appId: 'com.sop.display',
    appName: 'Axi Docs Display',
    webDir: '../build',
    server: {
        // HTTP 模式支持 OTA 热更新，url 指向后端地址（生产环境请改为实际服务器地址）
        androidScheme: 'http',
        url: undefined,
    },
    android: {
        allowMixedContent: true,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#26A69A',
            showSpinner: false
        },
        CapacitorUpdater: {
            autoUpdate: false
        },
        NativeGeolocation: {
        // 对应 android/app/src/main/java/com/sop/display/geolocation/NativeGeolocationPlugin.java
        }
    }
};
exports.default = config;
