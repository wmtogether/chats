// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Workspace",
    platforms: [
        .macOS(.v11)
    ],
    products: [
        .executable(
            name: "Workspace",
            targets: ["Workspace"]
        ),
    ],
    dependencies: [
        // Add any external dependencies here if needed
    ],
    targets: [
        .executableTarget(
            name: "Workspace",
            dependencies: [],
            path: "src",
            sources: ["main.swift"],
            resources: [
                // Embed resources directly into the executable
                .copy("Resources"),
                .process("Assets")
            ]
        ),
    ]
)