// LazyStockLogo.swift
// StockIQ

import SwiftUI

/// Manages throttled logo loading to avoid rate limits
@MainActor
final class LogoLoadQueue {
    static let shared = LogoLoadQueue()

    private var lastLoadTime: Date = .distantPast
    private let minDelay: TimeInterval = 0.05
    private var pendingLoads: [() -> Void] = []
    private var isProcessing = false

    func enqueue(_ load: @escaping () -> Void) {
        pendingLoads.append(load)
        processQueue()
    }

    private func processQueue() {
        guard !isProcessing, !pendingLoads.isEmpty else { return }
        isProcessing = true

        Task {
            while !pendingLoads.isEmpty {
                let now = Date()
                let elapsed = now.timeIntervalSince(lastLoadTime)

                if elapsed < minDelay {
                    try? await Task.sleep(nanoseconds: UInt64((minDelay - elapsed) * 1_000_000_000))
                }

                guard !pendingLoads.isEmpty else { break }
                let load = pendingLoads.removeFirst()
                lastLoadTime = Date()
                load()
            }
            isProcessing = false
        }
    }
}

/// A stock logo that only loads when visible, with throttling to avoid rate limits
struct LazyStockLogo: View {
    let url: URL?
    let symbol: String
    let size: CGFloat

    @State private var shouldLoad = false
    @State private var isVisible = false

    var body: some View {
        Group {
            if shouldLoad, let url = url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    case .failure, .empty:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .onAppear {
            isVisible = true
            guard !shouldLoad, url != nil else { return }
            LogoLoadQueue.shared.enqueue { [self] in
                if isVisible {
                    shouldLoad = true
                }
            }
        }
        .onDisappear {
            isVisible = false
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.tertiarySystemFill))
            .overlay {
                Text(symbol.prefix(1))
                    .font(size > 40 ? .title2 : .caption)
                    .fontWeight(.bold)
                    .foregroundStyle(.secondary)
            }
    }
}

#Preview {
    LazyStockLogo(
        url: URL(string: "https://logo.clearbit.com/apple.com"),
        symbol: "AAPL",
        size: 40
    )
}
