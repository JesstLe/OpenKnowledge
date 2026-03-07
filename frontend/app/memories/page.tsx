'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Plus, Trash2, Search, Loader2 } from 'lucide-react';

interface Memory {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  created_at: string;
  access_count: number;
}

const categories = [
  { value: 'fact', label: 'Fact', color: 'bg-blue-100 text-blue-800' },
  { value: 'preference', label: 'Preference', color: 'bg-green-100 text-green-800' },
  { value: 'goal', label: 'Goal', color: 'bg-purple-100 text-purple-800' },
  { value: 'important', label: 'Important', color: 'bg-red-100 text-red-800' },
];

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMemory, setNewMemory] = useState({ content: '', category: 'fact', importance: 5 });
  const { openaiApiKey } = useSettingsStore();

  const fetchMemories = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/memories/');
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleAddMemory = async () => {
    if (!newMemory.content.trim() || !openaiApiKey) return;

    try {
      const response = await fetch(`http://localhost:8000/api/memories/?api_key=${openaiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemory),
      });

      if (response.ok) {
        await fetchMemories();
        setNewMemory({ content: '', category: 'fact', importance: 5 });
        setShowAddForm(false);
      } else {
        alert('Failed to add memory');
      }
    } catch (error) {
      console.error('Add memory error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      const response = await fetch(`http://localhost:8000/api/memories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchMemories();
      } else {
        alert('Failed to delete memory');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !openaiApiKey) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/memories/search?query=${encodeURIComponent(searchQuery)}&api_key=${openaiApiKey}`
      );
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    return categories.find(c => c.value === category)?.color || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(c => c.value === category)?.label || category;
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Memories</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Memory
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Memory Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="What should I remember?"
              value={newMemory.content}
              onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
              className="min-h-[100px]"
            />
            <div className="flex gap-4">
              <Select
                value={newMemory.category}
                onValueChange={(value) => setNewMemory({ ...newMemory, category: value })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={10}
                value={newMemory.importance}
                onChange={(e) => setNewMemory({ ...newMemory, importance: parseInt(e.target.value) })}
                className="w-[100px]"
                placeholder="Importance (1-10)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMemory}>Add Memory</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memories List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Memories ({memories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-4">No memories yet</p>
              <p className="text-sm text-muted-foreground">
                Add memories manually or they will be extracted from conversations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <p className="font-medium mb-2">{memory.content}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className={getCategoryColor(memory.category)}>
                        {getCategoryLabel(memory.category)}
                      </Badge>
                      <span className="text-muted-foreground">
                        Importance: {memory.importance}/10
                      </span>
                      {memory.access_count > 0 && (
                        <span className="text-muted-foreground">
                          Accessed {memory.access_count} times
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memory.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
