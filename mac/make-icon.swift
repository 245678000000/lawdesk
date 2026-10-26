// 生成 1024×1024 的应用图标 PNG：深色圆角方块 + 宋体「律」字。用法：make-icon <输出.png>
import Cocoa

let size: CGFloat = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

// macOS 图标网格：824×824 的圆角矩形，四周留白 100
let rect = NSRect(x: 100, y: 100, width: 824, height: 824)
let shape = NSBezierPath(roundedRect: rect, xRadius: 185, yRadius: 185)
NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
shadow.shadowBlurRadius = 24
shadow.shadowOffset = NSSize(width: 0, height: -10)
shadow.set()
NSColor(red: 0.12, green: 0.12, blue: 0.117, alpha: 1).setFill()
shape.fill()
NSGraphicsContext.restoreGraphicsState()
NSGradient(colors: [NSColor(red: 0.20, green: 0.20, blue: 0.19, alpha: 1), NSColor(red: 0.09, green: 0.09, blue: 0.085, alpha: 1)])!
  .draw(in: shape, angle: -90)

let font = NSFont(name: "Songti SC Bold", size: 540) ?? NSFont(name: "STSongti-SC-Bold", size: 540) ?? NSFont.boldSystemFont(ofSize: 520)
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor(red: 0.97, green: 0.96, blue: 0.94, alpha: 1)]
let glyph = NSAttributedString(string: "律", attributes: attrs)
let gs = glyph.size()
glyph.draw(at: NSPoint(x: (size - gs.width) / 2, y: (size - gs.height) / 2 + 30))

// 底部一道赭石色短线
NSColor(red: 0.71, green: 0.33, blue: 0.16, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 412, y: 218, width: 200, height: 22), xRadius: 11, yRadius: 11).fill()

NSGraphicsContext.restoreGraphicsState()
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
