import { createLocalMediaStub } from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";

export default function ImportButton() {
  const addMedia = useProjectStore((s) => s.addMedia);

  const onImport = async () => {
    const path = await window.desktopAPI.openMediaFile();
    if (!path) return;
    const item = createLocalMediaStub(path);
    addMedia(item);
  };

  return <button onClick={onImport}>Import Media</button>;
}
