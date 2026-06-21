-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Memoly Users
CREATE TABLE IF NOT EXISTS public.memoly_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  plan text DEFAULT 'free',
  usage_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Memoly Conversations
CREATE TABLE IF NOT EXISTS public.memoly_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.memoly_users(id) ON DELETE CASCADE,
  title text DEFAULT '新しい会話',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Memoly Messages
CREATE TABLE IF NOT EXISTS public.memoly_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.memoly_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Memoly Long-term Memories
CREATE TABLE IF NOT EXISTS public.memoly_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.memoly_users(id) ON DELETE CASCADE,
  content text NOT NULL,
  memory_type text DEFAULT 'summary' CHECK (memory_type IN ('summary', 'profile')),
  created_at timestamptz DEFAULT now()
);

-- Memoly User Profile Attributes
CREATE TABLE IF NOT EXISTS public.memoly_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.memoly_users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key)
);

-- RLS有効化
ALTER TABLE public.memoly_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoly_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoly_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoly_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoly_profiles ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "memoly_users_own" ON public.memoly_users FOR ALL USING (auth.uid() = id);
CREATE POLICY "memoly_conversations_own" ON public.memoly_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "memoly_messages_own" ON public.memoly_messages FOR ALL
  USING (conversation_id IN (SELECT id FROM public.memoly_conversations WHERE user_id = auth.uid()));
CREATE POLICY "memoly_memories_own" ON public.memoly_memories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "memoly_profiles_own" ON public.memoly_profiles FOR ALL USING (auth.uid() = user_id);

-- 新規ユーザー登録時にmemoly_usersへ自動追加
CREATE OR REPLACE FUNCTION public.handle_memoly_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.memoly_users (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_memoly ON auth.users;
CREATE TRIGGER on_auth_user_created_memoly
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_memoly_new_user();

-- インデックス
CREATE INDEX IF NOT EXISTS memoly_memories_user_id_idx ON public.memoly_memories (user_id);
CREATE INDEX IF NOT EXISTS memoly_messages_conv_id_idx ON public.memoly_messages (conversation_id);
CREATE INDEX IF NOT EXISTS memoly_conversations_user_id_idx ON public.memoly_conversations (user_id);
