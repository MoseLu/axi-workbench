import { AxiSvgIcon } from "@axi/icons";

/**
 * Sidebar region: the keyword search control rendered inside the shell sidebar.
 * Owned by the shell host so hosted apps keep a single search surface.
 */
export function ShellSidebarSearch({
  ariaLabel,
  clearLabel,
  keyword,
  placeholder,
  onChange,
  onClear
}: {
  ariaLabel: string;
  clearLabel: string;
  keyword: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <label className="hosted-sidebar-search">
      <AxiSvgIcon name="search" size={15} />
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={keyword}
        onChange={(event) => onChange(event.target.value)}
      />
      {keyword ? (
        <button type="button" aria-label={clearLabel} onClick={onClear}>
          <AxiSvgIcon name="close" size={13} />
        </button>
      ) : null}
    </label>
  );
}
