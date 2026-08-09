import Foundation
import UIKit

enum ImageCompressor {
    static func jpegData(from input: Data, maxDimension: CGFloat = 1800, maxBytes: Int = 3_800_000) throws -> Data {
        guard let image = UIImage(data: input) else {
            throw APIError.transport("Cette image ne peut pas être lue.")
        }
        let scale = min(1, maxDimension / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }

        for quality in stride(from: 0.88, through: 0.45, by: -0.08) {
            if let data = resized.jpegData(compressionQuality: quality), data.count <= maxBytes {
                return data
            }
        }
        throw APIError.transport("La photo reste trop lourde après compression.")
    }
}
