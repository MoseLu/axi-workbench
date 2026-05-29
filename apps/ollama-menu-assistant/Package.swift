// swift-tools-version: 6.3

import PackageDescription

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
            dependencies: ["OllamaMenuAssistant"]
        ),
        .testTarget(
            name: "OllamaPetRunnerTests",
            dependencies: ["OllamaPetRunner"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
