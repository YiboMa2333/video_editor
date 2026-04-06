import { useProjectStore } from "../../store/useProjectStore";
import ImportButton from "./ImportButton";

export default function MediaBin() {
  const media = useProjectStore((s) => s.project.media);

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
            <li key={m.id}>
              <strong>{m.name}</strong> <span className="muted">({m.type})</span>
              <div className="path">{m.path}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
