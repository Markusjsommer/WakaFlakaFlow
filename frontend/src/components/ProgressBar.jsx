// Simple determinate progress bar driven by the polled Job payload.
// While a job is in flight it shows the bongo-cat loading animation
// (frontend/public/bongo-loading.gif); the image hides itself if that file is
// not present, so the bar still works without it.
export default function ProgressBar({ job }) {
  if (!job) return null;
  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
  const failed = job.status === 'failed';
  const working = !failed && progress < 100;
  return (
    <div className="progress">
      {working && (
        <div
          className="progress__bongos"
          style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <img
              key={i}
              src="/bongo-loading.gif"
              alt=""
              aria-hidden="true"
              className="progress__bongo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              style={{ display: 'block', height: 56, objectFit: 'contain' }}
            />
          ))}
        </div>
      )}
      <div className="progress__header">
        <span className="progress__label">
          {failed ? 'Failed' : job.message || job.status || 'Working…'}
        </span>
        <span className="progress__pct">{progress}%</span>
      </div>
      <div className="progress__track">
        <div
          className={'progress__fill' + (failed ? ' progress__fill--error' : '')}
          style={{ width: progress + '%' }}
        />
      </div>
    </div>
  );
}
