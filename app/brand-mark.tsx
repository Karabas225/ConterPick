const BRAND_MARK_SRC = "/assets/counterpick-mark-v3.png";

export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-mark-fallback">CP</span>
      <img className="brand-mark-image" src={BRAND_MARK_SRC} width={30} height={30} alt="" decoding="sync" fetchPriority="high" />
    </span>
  );
}
