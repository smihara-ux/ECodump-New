import { moveDay, today } from "./viewState";
export default function DateControls({
  value,
  onChange,
  todayValue = today(),
}) {
  return (
    <div className="receiving-toolbar" role="group" aria-label="日付選択">
      <button onClick={() => onChange(moveDay(value, -1))}>前日</button>
      <button onClick={() => onChange(todayValue)}>今日</button>
      <button onClick={() => onChange(moveDay(value, 1))}>翌日</button>
      <label>
        カレンダー
        <input
          aria-label="表示日"
          type="date"
          value={value}
          onInput={(e) => {
            if (e.currentTarget.value) onChange(e.currentTarget.value);
          }}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </label>
      <span>{value}</span>
    </div>
  );
}
