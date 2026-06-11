import { useRef, useState, useEffect } from 'react'
import { useRaceStore } from '../../store/raceStore'
import { useAuthStore } from '../../store/authStore'
import { useProjectStore } from '../../store/projectStore'
import { useModeStore } from '../../store/modeStore'
import type { ProjectMeta } from '../../store/projectStore'

export default function StartScreen() {
  const gpxRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  const { loadFromGpx, loadFromZip, race, routes, points } = useRaceStore()
  const { user, signOut, updatePassword } = useAuthStore()
  const { setMode, setViewerOnly } = useModeStore()
  const { projects, fetchProjects, loadProject, deleteProject, setCurrentProjectId } = useProjectStore()
  const [showProjects, setShowProjects] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loadingProject, setLoadingProject] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (showProjects) fetchProjects()
  }, [showProjects])

  const handleGpx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setViewerOnly(false); setCurrentProjectId(null); await loadFromGpx(f); e.target.value = '' }
  }
  const handleZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setViewerOnly(false); setCurrentProjectId(null); await loadFromZip(f); setMode('operation'); e.target.value = '' }
  }

  const handleLoadProject = async (p: ProjectMeta) => {
    setLoadingProject(p.id)
    setLoadError(null)
    try {
      const data = await loadProject(p.id)
      if (!data) { setLoadError('読み込みに失敗しました。再度お試しください。'); return }
      const d = data as { race?: unknown; routes?: unknown; points?: unknown }
      useRaceStore.setState({
        race: (d.race as typeof race) ?? null,
        routes: (d.routes as typeof routes) ?? [],
        points: (d.points as typeof points) ?? [],
      })
      setCurrentProjectId(p.id)
      setViewerOnly(!p.is_owner)
      setMode('operation')
      setShowProjects(false)
    } catch (e) {
      setLoadError(`エラー: ${String(e)}`)
    } finally {
      setLoadingProject(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await deleteProject(id)
    await fetchProjects()
    setDeleting(null)
  }

  const handleChangePassword = async () => {
    setPwError(null)
    if (!newPassword) { setPwError('パスワードを入力してください'); return }
    if (newPassword.length < 6) { setPwError('パスワードは6文字以上で入力してください'); return }
    if (newPassword !== confirmPassword) { setPwError('パスワードが一致しません'); return }
    setPwLoading(true)
    const err = await updatePassword(newPassword)
    setPwLoading(false)
    if (err) { setPwError(err); return }
    setPwMsg('パスワードを変更しました')
    setNewPassword(''); setConfirmPassword('')
    setTimeout(() => { setPwMsg(null); setShowChangePassword(false) }, 2000)
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-green-900 to-green-950 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-5 w-full max-w-sm mx-4 max-h-[92vh] overflow-y-auto">
        <div className="text-center">
          <div className="text-5xl mb-3">🏔️</div>
          <h1 className="text-2xl font-bold text-green-900">トレラン救護支援</h1>
          <p className="text-sm text-gray-500 mt-1">搬送ルート判断支援ツール</p>
        </div>

        {!showProjects ? (
          <div className="flex flex-col gap-3 w-full">
            <button onClick={() => gpxRef.current?.click()} className="w-full py-4 bg-green-700 hover:bg-green-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition">
              ＋ 新規作成
            </button>
            <p className="text-xs text-gray-400 text-center -mt-2">メインコースのGPXファイルを選択</p>
            <button onClick={() => setShowProjects(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition">
              ☁️ クラウドから開く
            </button>
            <button onClick={() => zipRef.current?.click()} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
              📂 ZIPから開く
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-700">プロジェクト一覧</span>
              <button onClick={() => setShowProjects(false)} className="text-xs text-gray-400 hover:text-gray-600">← 戻る</button>
            </div>
            {loadError && <p className="text-xs text-red-500 text-center">{loadError}</p>}
            {projects.length === 0
              ? <p className="text-xs text-gray-400 text-center py-4">保存済みプロジェクトがありません</p>
              : projects.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-3 border rounded-lg active:bg-gray-100" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <button type="button" onClick={() => handleLoadProject(p)} disabled={loadingProject === p.id} className="flex-1 text-left min-w-0 cursor-pointer">
                    <div className="flex items-center gap-1">
                      {loadingProject === p.id
                        ? <span className="text-xs text-gray-400">読み込み中…</span>
                        : <><span className="text-sm text-gray-800 font-medium truncate">{p.name || '無題'}</span>
                          {!p.is_owner && <span className="text-xs text-indigo-500 flex-shrink-0">共有</span>}</>
                      }
                    </div>
                    <div className="text-xs text-gray-400">{new Date(p.updated_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </button>
                  {p.is_owner && (
                    <button type="button" onClick={() => setDeleteConfirmId(p.id)} disabled={deleting === p.id} className="text-sm text-gray-300 hover:text-red-400 transition flex-shrink-0 p-1">🗑</button>
                  )}
                </div>
              ))
            }
          </div>
        )}

        <div className="flex flex-col gap-1 w-full text-xs text-gray-400">
          <span className="truncate">{user?.email}</span>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setShowChangePassword(true); setNewPassword(''); setConfirmPassword(''); setPwError(null); setPwMsg(null) }} className="hover:text-gray-600 underline">パスワード変更</button>
            <button onClick={signOut} className="hover:text-gray-600 underline">ログアウト</button>
          </div>
        </div>
      </div>

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <div className="font-bold text-gray-800 text-sm">パスワード変更</div>
              <button onClick={() => setShowChangePassword(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="flex flex-col gap-2">
              <input type="password" placeholder="新しいパスワード（6文字以上）" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <input type="password" placeholder="新しいパスワード（確認）" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwMsg && <p className="text-xs text-green-600">{pwMsg}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowChangePassword(false)} className="text-sm px-4 py-1.5 border rounded hover:bg-gray-50">キャンセル</button>
              <button onClick={handleChangePassword} disabled={pwLoading} className="text-sm px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded transition">{pwLoading ? '変更中…' : '変更'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs flex flex-col gap-4 p-6">
            <div className="font-bold text-gray-800">削除の確認</div>
            <p className="text-sm text-gray-600">「{projects.find(p => p.id === deleteConfirmId)?.name || '無題'}」を削除しますか？</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="text-sm px-4 py-1.5 border rounded hover:bg-gray-50">キャンセル</button>
              <button onClick={async () => { const id = deleteConfirmId; setDeleteConfirmId(null); await handleDelete(id) }} className="text-sm px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition">削除</button>
            </div>
          </div>
        </div>
      )}

      <input ref={gpxRef} type="file" accept=".gpx,application/octet-stream,application/xml,text/xml" className="hidden" onChange={handleGpx} />
      <input ref={zipRef} type="file" accept=".zip,application/zip,application/octet-stream" className="hidden" onChange={handleZip} />
    </div>
  )
}
