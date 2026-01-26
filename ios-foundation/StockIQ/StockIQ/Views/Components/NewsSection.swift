// NewsSection.swift
// StockIQ

import SwiftUI

struct NewsSection: View {
    let news: [NewsItem]
    var summary: String? = nil

    @State private var isExpanded = true

    var body: some View {
        if news.isEmpty {
            EmptyView()
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(news) { item in
                        NewsItemRow(item: item)

                        if item.id != news.last?.id {
                            Divider()
                                .padding(.leading, 8)
                        }
                    }
                }
                .padding(.top, 8)
            } label: {
                HStack {
                    Text("Recent News")
                        .font(.headline)
                    Spacer()
                    if let summary = summary {
                        Text(summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }
}

// MARK: - News Item Row

private struct NewsItemRow: View {
    let item: NewsItem

    var body: some View {
        if let url = item.url {
            Link(destination: url) {
                content
            }
            .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .font(.subheadline)
                .lineLimit(2)
                .foregroundStyle(.primary)

            HStack {
                Text(item.publisher)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(formatDate(item.publishedAt))
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 8)
    }

    private func formatDate(_ dateStr: String) -> String {
        // Try ISO8601 format first
        if let date = ISO8601DateFormatter().date(from: dateStr) {
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
        }
        // Fallback to basic date format
        if let date = DateFormatter.apiDate.date(from: dateStr) {
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
        }
        return dateStr
    }
}

#Preview {
    NewsSection(
        news: [
            NewsItem(
                title: "Apple Reports Record Q4 Revenue Driven by iPhone Sales",
                publisher: "Reuters",
                link: "https://reuters.com/apple-q4",
                publishedAt: "2024-01-25T14:30:00Z"
            ),
            NewsItem(
                title: "Apple Vision Pro Pre-Orders Begin This Weekend",
                publisher: "Bloomberg",
                link: "https://bloomberg.com/apple-vision",
                publishedAt: "2024-01-24T09:00:00Z"
            ),
            NewsItem(
                title: "Apple Expands AI Research Team Amid Industry Competition",
                publisher: "CNBC",
                link: "https://cnbc.com/apple-ai",
                publishedAt: "2024-01-23T16:45:00Z"
            )
        ],
        summary: "Mixed sentiment"
    )
    .padding()
    .background(Color.groupedBackground)
}
