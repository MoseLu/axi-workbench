import { MailCheck } from "lucide-react";

interface SideNavProps {
  filter: string;
  onFilterChange: (filter: string) => void;
}

const filterItems = [
  { id: "imap", label: "IMAP", glyph: "I" },
  { id: "gmail", label: "Gmail", glyph: "G" },
  { id: "mail", label: "Mail", glyph: "M" },
  { id: "outlook", label: "Outlook", glyph: "O" },
  { id: "otp", label: "OTP", glyph: "T" },
];

export function SideNav({ filter, onFilterChange }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label="主导航">
      <div className="nav-brand">
        <button
          type="button"
          className={`brand-logo ${filter === "all" ? "active" : ""}`}
          onClick={() => onFilterChange("all")}
          title="全部邮箱"
          aria-label="全部邮箱"
        >
          <MailCheck size={22} />
          <span className="tooltip">全部邮箱</span>
        </button>
      </div>

      <div className="nav-items">
        {filterItems.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => onFilterChange(item.id)}
            title={item.label}
            aria-label={item.label}
            >
              <span className="nav-glyph">{item.glyph}</span>
              <span className="tooltip">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
