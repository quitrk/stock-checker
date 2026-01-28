// PriceChange.swift
// StockIQ

import SwiftUI

struct PriceChange: View {
    let change: Double
    let changePercent: Double

    private var isUp: Bool { change >= 0 }

    private var changeDescription: String {
        if change > 0 {
            return "Up"
        } else if change < 0 {
            return "Down"
        } else {
            return "Unchanged"
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isUp ? "arrow.up.right" : "arrow.down.right")
                .accessibilityHidden(true)
            Text(changePercent.asPercent)
        }
        .font(.subheadline)
        .foregroundStyle(Color.forPriceChange(change))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(changeDescription) \(changePercent.asPercent)")
    }
}

#Preview {
    VStack(spacing: 16) {
        PriceChange(change: 2.34, changePercent: 1.33)
        PriceChange(change: -1.50, changePercent: -0.85)
        PriceChange(change: 0, changePercent: 0)
    }
    .padding()
}
