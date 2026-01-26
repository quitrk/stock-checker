// ChecklistView.swift
// StockIQ

import SwiftUI

struct ChecklistView: View {
    let categories: [ChecklistCategory]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(categories) { category in
                CategorySection(category: category)
            }
        }
        .padding(.horizontal)
    }
}

#Preview {
    ScrollView {
        ChecklistView(categories: [
            .preview,
            ChecklistCategory(
                id: "price",
                name: "Price Analysis",
                description: "Price level and delisting risk",
                items: [
                    ChecklistItem(
                        id: "price_level",
                        label: "Stock Price Level",
                        description: "Stocks below $1 face delisting risk.",
                        value: .double(248.04),
                        displayValue: "$248.04",
                        status: .safe,
                        thresholds: ChecklistItem.Thresholds(safe: ">$2", warning: "$1-$2", danger: "<$1")
                    )
                ],
                status: .safe,
                summaryItemId: nil
            )
        ])
        .padding(.vertical)
    }
    .background(Color(.systemGroupedBackground))
}
