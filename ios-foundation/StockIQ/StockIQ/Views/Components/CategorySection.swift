// CategorySection.swift
// StockIQ

import SwiftUI

struct CategorySection: View {
    let category: ChecklistCategory
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Header (tappable)
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                header
            }
            .buttonStyle(.plain)

            // Items (expandable)
            if isExpanded {
                Divider()
                    .padding(.horizontal)

                VStack(spacing: 0) {
                    ForEach(category.items) { item in
                        ChecklistItemRow(item: item)
                            .padding(.horizontal)

                        if item.id != category.items.last?.id {
                            Divider()
                                .padding(.leading, 44)
                        }
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: category.status.icon)
                .font(.title3)
                .foregroundStyle(category.status.color)

            VStack(alignment: .leading, spacing: 2) {
                Text(category.name)
                    .font(.headline)
                    .foregroundStyle(.primary)

                Text(category.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Summary value if available
            if let summary = category.summaryItem, summary.status != .unavailable {
                Text(summary.displayValue)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(summary.status.color)
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .rotationEffect(.degrees(isExpanded ? 90 : 0))
        }
        .padding()
    }
}

#Preview("Collapsed") {
    CategorySection(category: .preview)
        .padding()
        .background(Color(.systemGroupedBackground))
}

#Preview("Expanded") {
    CategorySection(category: .preview)
        .padding()
        .background(Color(.systemGroupedBackground))
}

// MARK: - Preview Helper

extension ChecklistCategory {
    static var preview: ChecklistCategory {
        ChecklistCategory(
            id: "volume_analysis",
            name: "Volume Analysis",
            description: "Unusual volume may indicate pump & dump",
            items: [
                ChecklistItem(
                    id: "volume_vs_median",
                    label: "Volume vs 90-Day Median",
                    description: "Current volume compared to typical daily volume.",
                    value: .double(0.9),
                    displayValue: "0.9x",
                    status: .safe,
                    thresholds: ChecklistItem.Thresholds(safe: "< 5x", warning: "5-20x", danger: "20x+")
                ),
                ChecklistItem(
                    id: "elevated_days",
                    label: "Volume Spike Days (60d)",
                    description: "Days with volume >= 5x average.",
                    value: .int(0),
                    displayValue: "0 days",
                    status: .safe,
                    thresholds: ChecklistItem.Thresholds(safe: "0-1 days", warning: "2-4 days", danger: "5+ days")
                ),
            ],
            status: .safe,
            summaryItemId: "volume_vs_median"
        )
    }
}
