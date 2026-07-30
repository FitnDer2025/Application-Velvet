import Foundation
import StoreKit

@MainActor
final class StoreKitService: ObservableObject {
    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasedProductIDs: Set<String> = []

    func prepare(productIDs: Set<String>) async throws {
        guard !productIDs.isEmpty else {
            products = []
            return
        }
        let loaded = try await Product.products(for: productIDs)
        products = loaded.sorted { $0.price < $1.price }
        await refreshEntitlements()
    }

    func purchase(_ product: Product) async throws {
        let result = try await product.purchase()
        if case let .success(verification) = result {
            let transaction = try verified(verification)
            await transaction.finish()
            await refreshEntitlements()
        }
    }

    func refreshEntitlements() async {
        var identifiers = Set<String>()
        for await result in Transaction.currentEntitlements {
            if let transaction = try? verified(result), transaction.revocationDate == nil {
                identifiers.insert(transaction.productID)
            }
        }
        purchasedProductIDs = identifiers
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case let .verified(value): return value
        case .unverified: throw APIError.transport("La transaction App Store n’a pas pu être vérifiée.")
        }
    }
}
