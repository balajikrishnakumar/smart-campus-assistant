import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, MessageSquare, FileText, Brain, Upload } from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';
import  DocumentSidebar from '@/components/DocumentSidebar';
import { ChatTab } from '@/components/ChatTab';
import { SummaryTab } from '@/components/SummaryTab';
import { QuizTab } from '@/components/QuizTab';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 glass-strong border-r border-border flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-display font-bold text-gradient">Smart Campus</h1>
              <p className="text-xs text-muted-foreground">Welcome, {user?.name}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            variant="gradient"
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Documents List */}
        <DocumentSidebar
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
          refreshTrigger={refreshTrigger}
        />
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col">
          {showUpload ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex items-center justify-center p-8"
            >
              <div className="max-w-2xl w-full">
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
                <Button
                  variant="ghost"
                  onClick={() => setShowUpload(false)}
                  className="w-full mt-4"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          ) : (
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              <div className="border-b border-border glass px-6">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="gap-2">
                    <Brain className="w-4 h-4" />
                    Quiz
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="flex-1 m-0">
                <ChatTab documentId={selectedDocId || ''} />
              </TabsContent>

              <TabsContent value="summary" className="flex-1 m-0">
                <SummaryTab documentId={selectedDocId || ''} />
              </TabsContent>

              <TabsContent value="quiz" className="flex-1 m-0">
                <QuizTab documentId={selectedDocId || ''} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
