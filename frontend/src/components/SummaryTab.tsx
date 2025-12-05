import { useState, useEffect } from "react";
import { studyAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const SummaryTab = ({ documentId }: { documentId: string }) => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    if (!documentId) return;

    setLoading(true);
    setSummary("");

    try {
      const res = await studyAPI.summarize(documentId);
      setSummary(res.summary);
    } catch (err) {
      setSummary("Failed to generate summary.");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (documentId) fetchSummary();
  }, [documentId]);

  return (
    <div className="p-6">
      <Button onClick={fetchSummary} className="mb-4">
        Regenerate Summary
      </Button>

      {loading ? (
        <p>Generating summary…</p>
      ) : (
        <pre className="whitespace-pre-wrap bg-secondary p-4 rounded-xl">
          {summary}
        </pre>
      )}
    </div>
  );
};
