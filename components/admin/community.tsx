"use client"
import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff, Pencil, Pin, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { api, fmtDate } from "@/lib/admin-api"
import { Empty, ErrorBox, Loading, Pill } from "./shared"

interface Post { id: number; title: string; content: string; imageUrl: string; linkUrl: string; isPinned: boolean; isPublished: boolean; authorName: string; createdAt: string; comments: number; reactions: number }
const blank = { title: "", content: "", imageUrl: "", linkUrl: "", isPinned: false, isPublished: true }

export function CommunitySection() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: number | null; form: typeof blank } | null>(null)
  const [del, setDel] = useState<Post | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { setErr(null); api<{ posts: Post[] }>("/api/admin/community").then((r) => setPosts(r.posts)).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])
  const fail = (e: unknown) => toast({ title: "Bajarilmadi", description: (e as Error).message, variant: "destructive" })

  async function save(publish: boolean) {
    if (!editing) return
    setBusy(true)
    try {
      const body = { ...editing.form, isPublished: publish, isPinned: publish && editing.form.isPinned }
      if (editing.id == null) await api("/api/admin/community", { method: "POST", json: body })
      else await api(`/api/admin/community/${editing.id}`, { method: "PATCH", json: body })
      toast({ title: publish ? "Nashr etildi" : "Qoralama saqlandi" }); setEditing(null); load()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const patch = (p: Post, body: object) => api(`/api/admin/community/${p.id}`, { method: "PATCH", json: body }).then(load).catch(fail)
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await api(`/api/admin/community/${del.id}`, { method: "DELETE" }); toast({ title: "Post o'chirildi" }); setDel(null); load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const set = (k: keyof typeof blank, v: string | boolean) => setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: v } } : s))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Faqat administratorlar rasmiy post va e'lon yarata oladi. Foydalanuvchilar postlarni ko'radi, izoh va reaksiya qoldiradi.</p>
        <Button onClick={() => setEditing({ id: null, form: { ...blank } })}><Plus />Yangi post</Button>
      </div>
      {err ? <ErrorBox message={err} onRetry={load} /> : !posts ? <Loading /> : !posts.length ? <Empty text="Hali postlar yo'q" /> : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">{p.isPinned && <Pill tone="primary"><Pin className="size-3 mr-1" />Mahkamlangan</Pill>}<Pill tone={p.isPublished ? "good" : "warn"}>{p.isPublished ? "Nashr etilgan" : "Qoralama"}</Pill>{!p.isPublished || <span className="text-xs text-muted-foreground">{p.comments} izoh • {p.reactions} reaksiya</span>}</div>
                  {p.title && <h3 className="font-semibold">{p.title}</h3>}
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.content}</p>
                  <p className="text-xs text-muted-foreground">{p.authorName} • {fmtDate(p.createdAt)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => setEditing({ id: p.id, form: { title: p.title, content: p.content, imageUrl: p.imageUrl, linkUrl: p.linkUrl, isPinned: p.isPinned, isPublished: p.isPublished } })}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label={p.isPublished ? "Yashirish" : "Nashr etish"} onClick={() => patch(p, { isPublished: !p.isPublished })}>{p.isPublished ? <EyeOff /> : <Eye />}</Button>
                  <Button variant="ghost" size="icon" aria-label="Mahkamlash" disabled={!p.isPublished} onClick={() => patch(p, { isPinned: !p.isPinned })}><Pin className={p.isPinned ? "text-primary" : ""} /></Button>
                  <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => setDel(p)}><Trash2 className="text-destructive" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id == null ? "Yangi rasmiy post" : "Postni tahrirlash"}</DialogTitle><DialogDescription>Nashr etilgan post barcha foydalanuvchilarga ko'rinadi. Qoralama faqat sizga.</DialogDescription></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="p-title">Sarlavha</Label><Input id="p-title" value={editing.form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-content">Matn *</Label><Textarea id="p-content" value={editing.form.content} maxLength={5000} className="min-h-[140px]" onChange={(e) => set("content", e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="p-img">Rasm havolasi</Label><Input id="p-img" type="url" placeholder="https://…" value={editing.form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="p-link">Havola</Label><Input id="p-link" type="url" placeholder="https://…" value={editing.form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.form.isPinned} onCheckedChange={(v) => set("isPinned", v)} />Nashr qilganda mahkamlash (avvalgi mahkamlangan post bo'shatiladi)</label>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={busy || !editing?.form.content.trim()} onClick={() => save(false)}>Qoralama</Button>
            <Button disabled={busy || !editing?.form.content.trim()} onClick={() => save(true)}>Nashr etish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Postni o'chirasizmi?</AlertDialogTitle><AlertDialogDescription>Post va uning barcha izohlari hamda reaksiyalari o'chadi. Bu amalni qaytarib bo'lmaydi.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Bekor qilish</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); remove() }}>O'chirish</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
