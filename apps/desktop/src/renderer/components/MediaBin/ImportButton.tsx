import { createLocalMediaStub } from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";

export default function ImportButton() {
  const addMedia = useProjectStore((s) => s.addMedia);
  const selectMedia = useProjectStore((s) => s.selectMedia);

  const onImport = async () => {
    const path = await window.desktopAPI.openMediaFile();
    if (!path) return;
    const item = createLocalMediaStub(path);
    addMedia(item);
    selectMedia(item.id);
  };

  return <button onClick={onImport}>Import Media</button>;
}
