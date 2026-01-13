import type { AnalystData } from '../../lib/types/index.js';
import './AnalystSection.css';

interface AnalystSectionProps {
  analystData: AnalystData;
  currentPrice: number;
}

export function AnalystSection({ analystData, currentPrice }: AnalystSectionProps) {
  const { targetPrice, targetPriceLow, targetPriceHigh, numberOfAnalysts, recommendationKey, recentRatings } = analystData;

  if (!targetPrice && !recommendationKey && recentRatings.length === 0) {
    return null;
  }

  const upside = targetPrice && currentPrice > 0
    ? ((targetPrice - currentPrice) / currentPrice * 100).toFixed(1)
    : null;

  return (
    <div className="analyst-section">
      <h3>Analyst Ratings</h3>

      <div className="analyst-summary">
        {targetPrice && (
          <div className="target-price">
            <span className="label">Median Target</span>
            <span className="value">${targetPrice.toFixed(2)}</span>
            {upside && (
              <span className={`upside ${parseFloat(upside) >= 0 ? 'positive' : 'negative'}`}>
                ({parseFloat(upside) >= 0 ? '+' : ''}{upside}%)
              </span>
            )}
          </div>
        )}

        {targetPriceLow && targetPriceHigh && (
          <div className="target-range">
            <span className="label">Range</span>
            <span className="value">${targetPriceLow.toFixed(2)} - ${targetPriceHigh.toFixed(2)}</span>
          </div>
        )}

        {recommendationKey && (
          <div className="recommendation">
            <span className="label">Consensus</span>
            <span className={`value recommendation-${recommendationKey.toLowerCase().replace('_', '')}`}>
              {recommendationKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
            {numberOfAnalysts && <span className="analyst-count">({numberOfAnalysts} analysts)</span>}
          </div>
        )}
      </div>

      {recentRatings.length > 0 && (
        <div className="recent-ratings">
          <h4>Recent Rating Changes</h4>
          <div className="ratings-list">
            {recentRatings.map((rating, index) => (
              <div key={index} className="rating-item">
                <span className="rating-firm">{rating.firm}</span>
                <span className={`rating-action action-${rating.action.toLowerCase()}`}>
                  {rating.action}
                </span>
                <span className="rating-grade">
                  {rating.fromGrade ? `${rating.fromGrade} → ` : ''}{rating.toGrade}
                </span>
                <span className="rating-date">{rating.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
