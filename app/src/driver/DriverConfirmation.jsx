export default function DriverConfirmation({
  trip,
  acknowledged,
  onConfirm,
  onMismatch,
}) {
  return (
    <section className="detail-section driver-confirmation">
      <h2>出発前の本人・車両確認</h2>
      <p>
        <b>{trip.driver}</b>
        <br />
        {trip.carrier}
        <br />
        <strong>{trip.registration}</strong>
      </p>
      <p>
        {trip.date} ／ {trip.id} ／ 配車版 {trip.assignmentVersion}
        <br />
        {trip.from} → {trip.to}
      </p>
      {acknowledged ? (
        <p role="status">この本人・車両・配車版を端末内で確認済み</p>
      ) : (
        <>
          <p>
            便ごとに車両を確認してください。代車・代走・行先変更後は再確認が必要です。
          </p>
          <button className="primary" onClick={onConfirm}>
            この内容で運行する
          </button>
          <button className="secondary" onClick={onMismatch}>
            内容が違う
          </button>
        </>
      )}
      <small>確認はこの端末内です。本人認証や管理者への送信とは別です。</small>
    </section>
  );
}
