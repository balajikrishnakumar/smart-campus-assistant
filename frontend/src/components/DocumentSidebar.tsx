import React, { useEffect, useState } from "react";
import { documentAPI } from "@/lib/api";
import { Trash2 } from "lucide-react";

interface Props {
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  refreshTrigger: number;
}

interface Doc {
  id: string;
  name: string;
}

const DocumentSidebar: React.FC<Props> = ({
  selectedDocId,
  onSelectDoc,
  refreshTrigger,
}) => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const list = await documentAPI.getAll();
      setDocs(list);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete document function
  const handleDelete = async (filename: string) => {
    if (!window.confirm("Delete this document permanently?")) return;

    try {
      await documentAPI.deleteDocument(filename);
      fetchDocs(); // refresh sidebar
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [refreshTrigger]);

  return (
    <div className="w-80 bg-black text-white border-r border-gray-800 h-full p-4 overflow-y-auto">
      <h2 className="font-semibold text-lg mb-4">Your Documents</h2>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className={`p-2 rounded flex justify-between items-center cursor-pointer transition-all
                ${
                  selectedDocId === doc.id
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }
              `}
            >
              <span onClick={() => onSelectDoc(doc.id)} className="flex-1">
                {doc.name}
              </span>

              <Trash2
                size={18}
                className="cursor-pointer text-red-400 hover:text-red-500 ml-3"
                onClick={() => handleDelete(doc.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentSidebar;
