import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { studyAPI } from "@/lib/api";

type RawQuestion = {
  question?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  // allow extra fields if backend sends type info
  type?: "mcq" | "true_false" | string;
};

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  type?: "mcq" | "true_false" | string;
}

interface QuizTabProps {
  documentId: string;
}

export const QuizTab = ({ documentId }: QuizTabProps) => {
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);

  const { toast } = useToast();

  // Helper: try to safely parse backend quiz output
  const safeParseQuiz = (raw: any): Question[] => {
    if (!raw) return [];
    // If backend already returned object/array
    if (Array.isArray(raw)) {
      return raw.map(normalizeQuestion).filter(Boolean) as Question[];
    }
    // If backend returned an object with .quiz field already parsed
    if (raw.quiz && Array.isArray(raw.quiz)) {
      return raw.quiz.map(normalizeQuestion).filter(Boolean) as Question[];
    }

    // raw is likely a string. Try parse JSON directly.
    if (typeof raw === "string") {
      // First try straight JSON.parse
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(normalizeQuestion).filter(Boolean) as Question[];
        // sometimes the parsed object has .quiz or .data
        if (Array.isArray(parsed.quiz)) return parsed.quiz.map(normalizeQuestion).filter(Boolean) as Question[];
      } catch (e) {
        // try to extract JSON array substring from within the string
        const jsonArrayMatch = raw.match(/\[[\s\S]*\]/m);
        if (jsonArrayMatch) {
          try {
            const parsed2 = JSON.parse(jsonArrayMatch[0]);
            if (Array.isArray(parsed2)) return parsed2.map(normalizeQuestion).filter(Boolean) as Question[];
          } catch (e2) {
            // fall through
          }
        }
      }

      // As a last resort, try to convert simple "1) Q ... A) ... B) ..." into one question
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
        const fallbackQuestion: Question = {
          question: lines.slice(0, 3).join(" "),
          options: ["A", "B", "C", "D"],
          correctAnswer: 0,
          explanation: "Fallback question — backend returned unexpected format.",
        };
        return [fallbackQuestion];
      }
    }

    return [];
  };

  // Normalize shape to Question
  const normalizeQuestion = (q: any): Question | null => {
    if (!q) return null;
    const questionText = q.question ?? q.prompt ?? q.q ?? "";
    const options = Array.isArray(q.options) && q.options.length > 0 ? q.options : q.choices ?? q.answers ?? [];
    const correct = typeof q.correctAnswer === "number" ? q.correctAnswer : (typeof q.answerIndex === "number" ? q.answerIndex : 0);
    if (!questionText) return null;
    return {
      question: String(questionText),
      options: options.length ? options.map(String) : ["True", "False", "Option C", "Option D"],
      correctAnswer: Math.max(0, Math.min(options.length - 1, Number(correct || 0))),
      explanation: q.explanation ?? q.explain ?? q.explanationText ?? "",
      type: q.type ?? (options.length === 2 ? "true_false" : "mcq"),
    };
  };

  // Fetch quiz from backend
  const fetchQuiz = async () => {
    if (!documentId) return;

    setLoading(true);
    setFinished(false);
    setScore(0);
    setIndex(0);
    setSelected(null);
    setShowAnswer(false);
    setQuiz([]);

    try {
      const res = await studyAPI.generateQuiz(documentId);
      // res may be { quiz: "...." } or { quiz: [...] } or string
      const serverQuiz = (res && (res.quiz ?? res)) as any;
      const parsed = safeParseQuiz(serverQuiz);
      if (!parsed || parsed.length === 0) {
        toast({
          title: "Quiz Error",
          description: "Server returned no valid quiz. Try again.",
          variant: "destructive",
        });
        setQuiz([]);
      } else {
        setQuiz(parsed);
      }
    } catch (err: any) {
      console.error("Quiz fetch error:", err);
      toast({
        title: "Quiz Error",
        description: err?.response?.data?.error || "Failed to generate quiz",
        variant: "destructive",
      });
      setQuiz([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Submit answer
  const handleSubmit = () => {
    if (selected === null) return;
    const q = quiz[index];
    if (!q) return;
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) setScore((s) => s + 1);
    setShowAnswer(true);
  };

  // Next question (or finish)
  const handleNext = () => {
    if (index < quiz.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowAnswer(false);
    } else {
      setFinished(true);
    }
  };

  const handleRetrySame = () => {
    setIndex(0);
    setSelected(null);
    setShowAnswer(false);
    setFinished(false);
    setScore(0);
  };

  // Defensive UI: loading / no-quiz states
  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Select a document to take a quiz</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (!quiz || quiz.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No quiz available.</p>
          <Button onClick={fetchQuiz} variant="outline">
            Generate Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Now safe to access quiz[index]
  const q = quiz[index];
  if (!q) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Unexpected quiz format. Try regenerating.</p>
        <Button onClick={fetchQuiz} className="ml-4">Generate Quiz</Button>
      </div>
    );
  }

  // UI when finished
  if (finished) {
    const percent = quiz.length ? Math.round((score / quiz.length) * 100) : 0;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <Trophy className="w-20 h-20 mx-auto text-primary mb-4" />
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground mb-4">You scored {score} / {quiz.length}</p>

          <div className="glass rounded-xl p-6 mb-6">
            <div className="text-4xl font-bold">{percent}%</div>
          </div>

          <div className="space-y-3">
            <Button className="w-full" variant="gradient" onClick={fetchQuiz}>Generate Different Questions</Button>
            <Button className="w-full" variant="outline" onClick={handleRetrySame}>Retry Same Quiz</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Main quiz view
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 h-full">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {index + 1} of {quiz.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${((index + 1) / quiz.length) * 100}%` }} className="h-full bg-primary" />
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-6">{q.question}</h3>

        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctAnswer;
            const isSelected = selected === i;

            const baseClass = "w-full p-4 rounded-xl border text-left transition-all";
            const className = showAnswer
              ? (isCorrect ? `${baseClass} border-green-500 bg-green-500/10` : (isSelected ? `${baseClass} border-red-500 bg-red-500/10` : `${baseClass} opacity-60`))
              : (isSelected ? `${baseClass} border-primary bg-primary/10` : `${baseClass} border-gray-300 hover:bg-gray-200`);

            return (
              <button key={i} onClick={() => !showAnswer && setSelected(i)} className={className}>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showAnswer && (
          <div className="mt-4 p-4 bg-black/10 rounded-lg">
            <p className="font-semibold">Explanation</p>
            <p className="text-sm mt-1">{q.explanation || "No explanation provided."}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6">
          {!showAnswer ? (
            <Button className="w-full" onClick={handleSubmit} disabled={selected === null}>Submit</Button>
          ) : (
            <Button className="w-full" onClick={handleNext}>Next Question</Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
