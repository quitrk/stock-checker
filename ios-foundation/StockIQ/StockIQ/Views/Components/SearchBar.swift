// SearchBar.swift
// StockIQ

import SwiftUI

struct SearchBar: View {
    @Binding var text: String
    var onSubmit: () -> Void
    var onClear: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            TextField("Search symbol (e.g. AAPL)", text: $text)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onSubmit(onSubmit)
                .accessibilityLabel("Stock symbol")
                .accessibilityHint("Enter a stock ticker symbol to search")

            if !text.isEmpty {
                Button {
                    text = ""
                    onClear()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Clear search")
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
        .padding()
    }
}

#Preview("Light") {
    SearchBar(text: .constant("AAPL"), onSubmit: {}, onClear: {})
        .background(Color(.systemGroupedBackground))
}

#Preview("Dark") {
    SearchBar(text: .constant("AAPL"), onSubmit: {}, onClear: {})
        .background(Color(.systemGroupedBackground))
        .preferredColorScheme(.dark)
}
