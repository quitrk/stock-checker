// AddToWatchlistButton.swift
// StockIQ

import SwiftUI

struct AddToWatchlistButton: View {
    @Environment(APIClient.self) private var api

    let symbol: String

    @State private var showSheet = false
    @State private var watchlists: [WatchlistSummary] = []
    @State private var isLoading = false
    @State private var loadingWatchlistId: String?
    @State private var errorMessage: String?
    @State private var showCreateForm = false
    @State private var newWatchlistName = ""
    @State private var isCreating = false

    var body: some View {
        Button {
            showSheet = true
        } label: {
            Image(systemName: "plus.circle")
        }
        .accessibilityLabel("Add \(symbol) to watchlist")
        .sheet(isPresented: $showSheet) {
            NavigationStack {
                watchlistContent
                    .navigationTitle("Add to Watchlist")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") {
                                showSheet = false
                            }
                        }
                    }
            }
            .environment(api)
            .presentationDetents([.medium, .large])
            .task {
                await loadWatchlists()
            }
        }
    }

    @ViewBuilder
    private var watchlistContent: some View {
        if !api.isAuthenticated {
            ContentUnavailableView {
                Label("Sign In Required", systemImage: "person.crop.circle")
            } description: {
                Text("Sign in to save stocks to your watchlists")
            }
        } else if isLoading && watchlists.isEmpty {
            ProgressView()
        } else if let error = errorMessage, watchlists.isEmpty {
            ContentUnavailableView {
                Label("Error", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Try Again") {
                    Task { await loadWatchlists() }
                }
                .buttonStyle(.bordered)
            }
        } else {
            List {
                Section {
                    ForEach(watchlists) { watchlist in
                        WatchlistToggleRow(
                            watchlist: watchlist,
                            symbol: symbol,
                            isLoading: loadingWatchlistId == watchlist.id,
                            onToggle: { isIn in
                                Task { await toggleSymbol(watchlistId: watchlist.id, isInWatchlist: isIn) }
                            }
                        )
                    }
                }

                Section {
                    if showCreateForm {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                TextField("Watchlist name", text: $newWatchlistName)
                                    .textFieldStyle(.plain)
                                    .submitLabel(.done)
                                    .onSubmit {
                                        Task { await createAndAdd() }
                                    }

                                if isCreating {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Button("Add") {
                                        Task { await createAndAdd() }
                                    }
                                    .disabled(newWatchlistName.trimmingCharacters(in: .whitespaces).isEmpty)
                                }
                            }

                            if let error = errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                    } else {
                        Button {
                            showCreateForm = true
                        } label: {
                            Label("Create New Watchlist", systemImage: "plus")
                        }
                    }
                }
            }
        }
    }

    private func loadWatchlists() async {
        guard api.isAuthenticated else { return }

        isLoading = true
        errorMessage = nil

        do {
            watchlists = try await api.getWatchlists()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func toggleSymbol(watchlistId: String, isInWatchlist: Bool) async {
        loadingWatchlistId = watchlistId

        do {
            if isInWatchlist {
                _ = try await api.removeSymbol(from: watchlistId, symbol: symbol)
            } else {
                _ = try await api.addSymbol(to: watchlistId, symbol: symbol)
            }
            // Refresh watchlists to get updated items
            watchlists = try await api.getWatchlists()
        } catch {
            // Could show error toast here
        }

        loadingWatchlistId = nil
    }

    private func createAndAdd() async {
        let name = newWatchlistName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }

        isCreating = true
        errorMessage = nil

        do {
            let created = try await api.createWatchlist(name: name)
            _ = try await api.addSymbol(to: created.id, symbol: symbol)
            watchlists = try await api.getWatchlists()
            newWatchlistName = ""
            showCreateForm = false
        } catch {
            errorMessage = error.localizedDescription
        }

        isCreating = false
    }
}

// MARK: - Watchlist Toggle Row

private struct WatchlistToggleRow: View {
    let watchlist: WatchlistSummary
    let symbol: String
    let isLoading: Bool
    let onToggle: (Bool) -> Void

    private var isInWatchlist: Bool {
        watchlist.items.contains { $0.symbol.uppercased() == symbol.uppercased() }
    }

    var body: some View {
        Button {
            onToggle(isInWatchlist)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(watchlist.name)
                        .foregroundStyle(.primary)
                    Text("\(watchlist.symbolCount) symbols")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else if isInWatchlist {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityLabel(watchlist.name)
        .accessibilityValue(isInWatchlist ? "Added" : "Not added")
        .accessibilityHint(isInWatchlist ? "Double tap to remove from watchlist" : "Double tap to add to watchlist")
    }
}

#Preview {
    AddToWatchlistButton(symbol: "AAPL")
        .environment(APIClient(config: .development))
}
