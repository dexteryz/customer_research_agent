import { FC, useState } from 'react';
import { Input } from './input';
import { Button } from './button';
import { TagBadge } from './tag-badge';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagEditor: FC<TagEditorProps> = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');

  function addTag() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
      setInput('');
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1">
            <TagBadge label={tag} />
            <Button size="icon" variant="ghost" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
              ×
            </Button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
          placeholder={placeholder || 'Add tag'}
          className="w-32"
        />
        <Button type="button" onClick={addTag} disabled={!input.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}; 