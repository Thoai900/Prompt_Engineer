import React from 'react';
import { Star, GitFork, Tag } from 'lucide-react';
import { RepoHit } from '../../utils/repoInference';

interface Props {
  repo: RepoHit;
  selected: boolean;
  onClick: () => void;
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

/** Card repo trong kết quả tìm GitHub — hiển thị giàu: avatar, sao, ngôn ngữ, topic, cập nhật. */
export default function RepoCard({ repo, selected, onClick }: Props) {
  const [owner, name] = repo.fullName.includes('/')
    ? [repo.fullName.split('/')[0], repo.fullName.split('/').slice(1).join('/')]
    : ['', repo.fullName];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
        selected
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900/60 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {repo.ownerAvatar ? (
            <img
              src={repo.ownerAvatar}
              alt=""
              className="w-6 h-6 rounded-md shrink-0 border border-slate-200 dark:border-slate-700"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate min-w-0">
            {owner && <span className="text-slate-400 dark:text-slate-500">{owner}/</span>}
            <span className="font-bold text-slate-800 dark:text-slate-100">{name}</span>
          </span>
        </div>
        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 shrink-0">
          <Star size={11} className="fill-current" /> {compact(repo.stars)}
        </span>
      </div>

      {repo.description && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{repo.description}</span>
      )}

      {repo.topics && repo.topics.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {repo.topics.slice(0, 4).map((t) => (
            <span key={t} className="text-[9px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5 flex-wrap text-[9px] text-slate-400 dark:text-slate-500">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 inline-block" /> {repo.language}
          </span>
        )}
        {typeof repo.forks === 'number' && repo.forks > 0 && (
          <span className="flex items-center gap-0.5"><GitFork size={9} /> {compact(repo.forks)}</span>
        )}
        {repo.license && (
          <span className="flex items-center gap-0.5"><Tag size={9} /> {repo.license}</span>
        )}
        {repo.updatedAt && <span>cập nhật {repo.updatedAt.slice(0, 10)}</span>}
      </div>
    </button>
  );
}
