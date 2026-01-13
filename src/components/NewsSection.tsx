import type { NewsItem } from '../../lib/types/index.js';
import './NewsSection.css';

interface NewsSectionProps {
  news: NewsItem[];
}

export function NewsSection({ news }: NewsSectionProps) {
  if (news.length === 0) {
    return null;
  }

  return (
    <div className="news-section">
      <h3>Recent News</h3>
      <div className="news-list">
        {news.map((item, index) => (
          <a
            key={index}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="news-item"
          >
            <div className="news-title">{item.title}</div>
            <div className="news-meta">
              <span className="news-publisher">{item.publisher}</span>
              <span className="news-date">
                {new Date(item.publishedAt).toLocaleDateString()}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
