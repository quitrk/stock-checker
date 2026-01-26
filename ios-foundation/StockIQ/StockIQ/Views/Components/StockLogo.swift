// StockLogo.swift
// StockIQ

import SwiftUI

struct StockLogo: View {
    let url: URL?
    let symbol: String
    var size: CGFloat = 48

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            case .failure:
                placeholder
            case .empty:
                placeholder
                    .overlay {
                        ProgressView()
                            .scaleEffect(0.5)
                    }
            @unknown default:
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
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

#Preview("Light") {
    HStack(spacing: 16) {
        StockLogo(url: nil, symbol: "AAPL")
        StockLogo(url: nil, symbol: "MSFT", size: 32)
    }
    .padding()
    .background(Color(.secondarySystemGroupedBackground))
}

#Preview("Dark") {
    HStack(spacing: 16) {
        StockLogo(url: nil, symbol: "AAPL")
        StockLogo(url: nil, symbol: "MSFT", size: 32)
    }
    .padding()
    .background(Color(.secondarySystemGroupedBackground))
    .preferredColorScheme(.dark)
}
