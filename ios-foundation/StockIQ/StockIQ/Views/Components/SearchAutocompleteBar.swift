// SearchAutocompleteBar.swift
// StockIQ

import SwiftUI

struct SearchAutocompleteBar: View {
    @Environment(APIClient.self) private var api

    @Binding var text: String
    var onSelect: (String) -> Void
    var onSubmit: () -> Void
    var onClear: () -> Void

    @AppStorage("recentSearches") private var recentSearchesData: Data = Data()
    @State private var results: [SearchResult] = []
    @State private var isSearching = false
    @State private var showDropdown = false
    @State private var searchTask: Task<Void, Never>?
    @State private var isSelecting = false
    @FocusState private var isFocused: Bool

    private var recentSearches: [String] {
        (try? JSONDecoder().decode([String].self, from: recentSearchesData)) ?? []
    }

    private var showRecents: Bool {
        isFocused && text.trimmingCharacters(in: .whitespaces).isEmpty && !recentSearches.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Results/Recents dropdown (above search bar)
            if showDropdown && !results.isEmpty {
                resultsView
            } else if showRecents {
                recentsView
            }

            // Search input (docked at bottom)
            searchInputView
        }
        .onChange(of: isFocused) { _, focused in
            withAnimation(.easeInOut(duration: 0.2)) {
                showDropdown = focused && !results.isEmpty
            }
        }
    }

    // MARK: - Search Input

    private var searchInputView: some View {
        VStack(spacing: 0) {
            Divider()

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.white.opacity(0.6))
                    .accessibilityHidden(true)

                TextField("Search symbol or company", text: $text)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .focused($isFocused)
                    .onSubmit {
                        hideDropdown()
                        if !text.isEmpty {
                            addToRecents(text.uppercased())
                        }
                        onSubmit()
                    }
                    .onChange(of: text) { _, newValue in
                        performSearch(query: newValue)
                    }
                    .accessibilityLabel("Stock symbol")

                if isSearching {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(.white)
                } else if !text.isEmpty {
                    Button {
                        text = ""
                        hideDropdown()
                        onClear()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .accessibilityLabel("Clear search")
                }
            }
            .padding()
            .background(Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .background(Color(red: 0.1, green: 0.1, blue: 0.12))
    }

    // MARK: - Results View

    private var resultsView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(results) { result in
                    SearchResultRow(result: result)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectResult(result.symbol)
                        }

                    if result.id != results.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.1))
                    }
                }
            }
        }
        .frame(maxHeight: 320)
        .background(Color(red: 0.15, green: 0.15, blue: 0.17))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 12, y: -4)
        .padding(.horizontal)
        .padding(.bottom, 8)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    // MARK: - Recents View

    private var recentsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Recent")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
                Button("Clear") {
                    clearRecents()
                }
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal)
            .padding(.vertical, 10)

            ForEach(Array(recentSearches.enumerated()), id: \.element) { index, symbol in
                VStack(spacing: 0) {
                    if index > 0 {
                        Divider()
                            .background(Color.white.opacity(0.1))
                    }

                    HStack {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundStyle(.white.opacity(0.5))
                            .font(.subheadline)
                        Text(symbol)
                            .font(.body)
                            .foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "arrow.up.left")
                            .foregroundStyle(.white.opacity(0.3))
                            .font(.caption)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectResult(symbol)
                    }
                }
            }
        }
        .background(Color(red: 0.15, green: 0.15, blue: 0.17))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 12, y: -4)
        .padding(.horizontal)
        .padding(.bottom, 8)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    // MARK: - Actions

    private func selectResult(_ symbol: String) {
        Haptics.light()
        isSelecting = true
        text = symbol
        hideDropdown()
        addToRecents(symbol)
        onSelect(symbol)
        isSelecting = false
    }

    private func performSearch(query: String) {
        searchTask?.cancel()

        guard !isSelecting else { return }

        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 1 else {
            results = []
            withAnimation { showDropdown = false }
            isSearching = false
            return
        }

        isSearching = true

        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }

            do {
                let searchResults = try await api.searchSymbols(query: trimmed)
                guard !Task.isCancelled else { return }
                results = searchResults
                withAnimation { showDropdown = !searchResults.isEmpty }
            } catch {
                guard !Task.isCancelled else { return }
                results = []
                withAnimation { showDropdown = false }
            }
            isSearching = false
        }
    }

    private func hideDropdown() {
        showDropdown = false
        results = []
        searchTask?.cancel()
        isFocused = false
    }

    // MARK: - Recents Management

    private func addToRecents(_ symbol: String) {
        var recents = recentSearches
        recents.removeAll { $0 == symbol }
        recents.insert(symbol, at: 0)
        if recents.count > 5 {
            recents = Array(recents.prefix(5))
        }
        recentSearchesData = (try? JSONEncoder().encode(recents)) ?? Data()
    }

    private func clearRecents() {
        recentSearchesData = Data()
    }
}

// MARK: - Search Result Row

private struct SearchResultRow: View {
    let result: SearchResult

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(result.symbol)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                Text(result.name)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1)
            }

            Spacer()

            Text(result.type.displayName)
                .font(.caption2)
                .fontWeight(.medium)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(Color.accentColor.opacity(0.2))
                .foregroundStyle(Color.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}

#Preview {
    SearchAutocompleteBar(
        text: .constant(""),
        onSelect: { _ in },
        onSubmit: {},
        onClear: {}
    )
    .background(Color(.systemGroupedBackground))
    .environment(APIClient(config: .development))
    .preferredColorScheme(.dark)
}
