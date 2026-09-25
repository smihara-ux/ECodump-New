import { Wifi } from 'lucide-react';

// Decorative preview chrome, not live device/network telemetry.
export default function PhoneStatus() {
  return <div className="iphone-hardware" aria-hidden="true">
    <span className="iphone-clock">9:41</span>
    <i className="iphone-island"><b /></i>
    <span className="iphone-indicators">
      <svg width="19" height="16" viewBox="0 0 19 16" fill="currentColor"><rect x="0" y="10" width="3" height="6" rx="1"/><rect x="5" y="7" width="3" height="9" rx="1"/><rect x="10" y="3" width="3" height="13" rx="1"/><rect x="15" y="0" width="3" height="16" rx="1"/></svg>
      <Wifi size={19} strokeWidth={2.5} />
      <span className="iphone-battery"><b /></span>
    </span>
  </div>;
}
