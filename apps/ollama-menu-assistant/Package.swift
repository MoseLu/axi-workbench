// swift-tools-version: 6.3

import PackageDescription

let developerDir = Context.environment["DEVELOPER_DIR"] ?? "/Library/Developer/CommandLineTools"
// Standalone Command Line Tools do not add Swift Testing's framework and macro paths to SwiftPM test targets.
let testingSwiftSettings: [SwiftSetting] = [
    .unsafeFlags([
        "-F",
        "\(developerDir)/Library/Developer/Frameworks",
        "-load-plugin-library",
        "\(developerDir)/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib",
    ], .when(platforms: [.macOS])),
]
let testingLinkerSettings: [LinkerSetting] = [
    .unsafeFlags([
        "-F",
        "\(developerDir)/Library/Developer/Frameworks",
        "-Xlinker",
        "-rpath",
        "-Xlinker",
        "\(developerDir)/Library/Developer/Frameworks",
        "-Xlinker",
        "-rpath",
        "-Xlinker",
        "\(developerDir)/Library/Developer/usr/lib",
    ], .when(platforms: [.macOS])),
    .linkedFramework("Testing", .when(platforms: [.macOS])),
    .linkedFramework("_Testing_AppKit", .when(platforms: [.macOS])),
    .linkedFramework("_Testing_CoreGraphics", .when(platforms: [.macOS])),
    .linkedFramework("_Testing_Foundation", .when(platforms: [.macOS])),
]

let package = Package(
    name: "OllamaMenuAssistant",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "OllamaMenuAssistant", targets: ["OllamaMenuAssistant"]),
        .executable(name: "OllamaPetRunner", targets: ["OllamaPetRunner"]),
    ],
    targets: [
        .executableTarget(
            name: "OllamaMenuAssistant",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("SwiftUI"),
                .linkedFramework("Speech"),
                .linkedFramework("Carbon"),
                .linkedFramework("ServiceManagement"),
                .linkedLibrary("sqlite3"),
            ]
        ),
        .executableTarget(
            name: "OllamaPetRunner",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("ImageIO"),
                .linkedFramework("QuartzCore"),
                .linkedFramework("SceneKit"),
            ]
        ),
        .testTarget(
            name: "OllamaMenuAssistantTests",
            dependencies: ["OllamaMenuAssistant"],
            swiftSettings: testingSwiftSettings,
            linkerSettings: testingLinkerSettings
        ),
        .testTarget(
            name: "OllamaPetRunnerTests",
            dependencies: ["OllamaPetRunner"],
            swiftSettings: testingSwiftSettings,
            linkerSettings: testingLinkerSettings
        ),
    ],
    swiftLanguageModes: [.v6]
)
