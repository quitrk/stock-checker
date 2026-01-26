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

            TextField("Search symbol (e.g. AAPL)", text: $text)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onSubmit(onSubmit)

            if !text.isEmpty {
                Button {
                    text = ""
                    onClear()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
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
