import AppKit
import Foundation

let outputPath = CommandLine.arguments.dropFirst().first ?? "Resources/AppIcon.png"
let size = NSSize(width: 1024, height: 1024)
let rect = CGRect(origin: .zero, size: size)

let image = NSImage(size: size)
image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
    fputs("Failed to create graphics context\n", stderr)
    exit(1)
}

context.setShouldAntialias(true)
context.setAllowsAntialiasing(true)

let backgroundPath = NSBezierPath(roundedRect: rect.insetBy(dx: 56, dy: 56), xRadius: 220, yRadius: 220)
backgroundPath.addClip()

let backgroundGradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.04, green: 0.06, blue: 0.12, alpha: 1.0),
    NSColor(calibratedRed: 0.08, green: 0.15, blue: 0.31, alpha: 1.0),
    NSColor(calibratedRed: 0.10, green: 0.38, blue: 0.56, alpha: 1.0),
])!
backgroundGradient.draw(in: backgroundPath, angle: -42)

let topShine = NSGradient(colors: [
    NSColor(calibratedWhite: 1.0, alpha: 0.24),
    NSColor(calibratedWhite: 1.0, alpha: 0.02),
])!
topShine.draw(in: NSBezierPath(roundedRect: rect.insetBy(dx: 70, dy: 70), xRadius: 200, yRadius: 200), angle: 90)

NSColor(calibratedWhite: 1.0, alpha: 0.14).setStroke()
let rim = NSBezierPath(roundedRect: rect.insetBy(dx: 74, dy: 74), xRadius: 196, yRadius: 196)
rim.lineWidth = 3
rim.stroke()

let center = CGPoint(x: 512, y: 512)
let orbitRect = CGRect(x: -148, y: -360, width: 296, height: 720)
let rotations: [CGFloat] = [0, .pi / 3, -.pi / 3]

func drawOrbitGlow(rotation: CGFloat) {
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    context.rotate(by: rotation)
    context.addEllipse(in: orbitRect)
    context.setLineWidth(104)
    context.setStrokeColor(NSColor(calibratedRed: 0.10, green: 0.82, blue: 0.95, alpha: 0.24).cgColor)
    context.setShadow(
        offset: .zero,
        blur: 46,
        color: NSColor(calibratedRed: 0.05, green: 0.72, blue: 1.0, alpha: 0.54).cgColor
    )
    context.strokePath()
    context.restoreGState()
}

func drawOrbit(rotation: CGFloat) {
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    context.rotate(by: rotation)
    context.addEllipse(in: orbitRect)
    context.setLineWidth(78)
    context.replacePathWithStrokedPath()
    context.clip()

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let gradient = CGGradient(
        colorsSpace: colorSpace,
        colors: [
            NSColor(calibratedRed: 0.95, green: 1.00, blue: 1.00, alpha: 0.96).cgColor,
            NSColor(calibratedRed: 0.20, green: 0.89, blue: 0.98, alpha: 0.94).cgColor,
            NSColor(calibratedRed: 0.55, green: 0.45, blue: 1.00, alpha: 0.92).cgColor,
        ] as CFArray,
        locations: [0.0, 0.54, 1.0]
    )!

    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: -260, y: -410),
        end: CGPoint(x: 250, y: 410),
        options: []
    )
    context.restoreGState()
}

func drawOrbitHighlight(rotation: CGFloat) {
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    context.rotate(by: rotation)
    context.addEllipse(in: orbitRect.insetBy(dx: 20, dy: 20))
    context.setLineWidth(7)
    context.setStrokeColor(NSColor(calibratedWhite: 1.0, alpha: 0.50).cgColor)
    context.strokePath()
    context.restoreGState()
}

for rotation in rotations {
    drawOrbitGlow(rotation: rotation)
}

context.setBlendMode(.screen)
for rotation in rotations {
    drawOrbit(rotation: rotation)
}
context.setBlendMode(.normal)

for rotation in rotations {
    drawOrbitHighlight(rotation: rotation)
}

let coreShadow = NSShadow()
coreShadow.shadowBlurRadius = 34
coreShadow.shadowOffset = .zero
coreShadow.shadowColor = NSColor(calibratedRed: 0.28, green: 0.92, blue: 1.0, alpha: 0.74)
coreShadow.set()

let coreRect = CGRect(x: 444, y: 444, width: 136, height: 136)
let coreGradient = NSGradient(colors: [
    NSColor(calibratedWhite: 1.0, alpha: 1.0),
    NSColor(calibratedRed: 0.42, green: 0.93, blue: 1.0, alpha: 1.0),
    NSColor(calibratedRed: 0.18, green: 0.40, blue: 0.92, alpha: 1.0),
])!
coreGradient.draw(in: NSBezierPath(ovalIn: coreRect), angle: -45)

NSShadow().set()
NSColor(calibratedWhite: 1.0, alpha: 0.72).setFill()
let coreSpark = NSBezierPath()
coreSpark.move(to: CGPoint(x: 512, y: 579))
coreSpark.line(to: CGPoint(x: 532, y: 532))
coreSpark.line(to: CGPoint(x: 579, y: 512))
coreSpark.line(to: CGPoint(x: 532, y: 492))
coreSpark.line(to: CGPoint(x: 512, y: 445))
coreSpark.line(to: CGPoint(x: 492, y: 492))
coreSpark.line(to: CGPoint(x: 445, y: 512))
coreSpark.line(to: CGPoint(x: 492, y: 532))
coreSpark.close()
coreSpark.fill()

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Failed to encode PNG\n", stderr)
    exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath)
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try pngData.write(to: outputURL)
print(outputURL.path)
