import { useProjectStore } from "../../store/useProjectStore";
import ImportButton from "./ImportButton";

export default function MediaBin() {
  const media = useProjectStore((s) => s.project.media);
  const selectedMediaId = useProjectStore((s) => s.selectedMediaId);
  const selectMedia = useProjectStore((s) => s.selectMedia);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Media Bin</h2>
        <ImportButton />
      </div>

      {media.length === 0 ? (
        <p className="muted">No media imported yet.</p>
      ) : (
        <ul className="media-list">
          {media.map((m) => (
            <li
              key={m.id}
              onClick={() => selectMedia(m.id)}
              style={{
                backgroundColor: selectedMediaId === m.id ? '#252526' : 'transparent',
                cursor: 'pointer',
                padding: '8px',
                borderLeft: selectedMediaId === m.id ? '2px solid #0e639c' : '2px solid transparent',
              }}
            >
              <strong>{m.name}</strong> <span className="muted">({m.type})</span>
              <div className="path">{m.path}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
