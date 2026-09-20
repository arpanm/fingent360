import { useEffect, useState, type ReactNode } from 'react';
import {
  ReleaseGroupsSchema,
  groupContainsEdition,
  type FeedItem,
  type ReleaseGroup,
} from '@fingent360/contracts';
import { json } from './net';
import './release-groups.css';

export function useReleaseGroups(items: FeedItem[]) {
  const [groups, setGroups] = useState<ReleaseGroup[]>([]);
  const [message, setMessage] = useState('');
  const [revision, retry] = useState(0);
  useEffect(() => {
    let current = true;
    setGroups([]);
    setMessage(items.length ? 'Checking reviewed release groups…' : '');
    async function load() {
      const found = new Map<string, ReleaseGroup>();
      let conflicted = false;
      for (let offset = 0; offset < items.length; offset += 50) {
        const query = new URLSearchParams({
          sources: items
            .slice(offset, offset + 50)
            .map((item) => item.id)
            .join(','),
        });
        const value = ReleaseGroupsSchema.parse(
          await json(`/events/release-groups?${query}`),
        );
        if (value.limited)
          throw new Error('The grouping review limit was reached.');
        conflicted ||= value.conflicted;
        for (const group of value.groups) {
          const previous = found.get(group.eventId);
          if (previous && JSON.stringify(previous) !== JSON.stringify(group))
            throw new Error('Groups changed during pagination.');
          found.set(group.eventId, group);
        }
      }
      const memberships = [...found.values()].flatMap((group) =>
        group.members.map((member) => member.id),
      );
      if (new Set(memberships).size !== memberships.length)
        throw new Error('Group memberships changed during pagination.');
      if (!current) return;
      setGroups([...found.values()]);
      setMessage(
        conflicted
          ? 'Conflicting event groups are shown as separate releases pending review.'
          : '',
      );
    }
    void load().catch(() => {
      if (current) {
        setGroups([]);
        setMessage(
          'Release grouping is unavailable. All releases are shown separately.',
        );
      }
    });
    return () => {
      current = false;
    };
  }, [items, revision]);
  return { groups, message, retry: () => retry((value) => value + 1) };
}

export function ReleaseGroupContext({
  group,
  items = [],
  onRead,
}: {
  group: ReleaseGroup;
  items?: FeedItem[];
  onRead?: (index: number) => void;
}) {
  return (
    <div className="release-group-context">
      <a href={`#events/${group.eventId}`}>Same event: {group.title}</a>
      <p>{group.rationale}</p>
      <small>
        Reviewed event version {group.eventVersion} · {group.members.length}{' '}
        distinct releases
      </small>
      <ul>
        {group.members.map((member) => (
          <li key={member.id}>
            <a
              href={`#read/${member.id}`}
              onClick={() => {
                const index = items.findIndex((item) => item.id === member.id);
                if (index >= 0) onRead?.(index);
              }}
            >
              Read release:{' '}
              {items.find((item) => item.id === member.id)?.title ?? member.id}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupedReleaseList({
  items,
  groups,
  separate,
  open,
  onOpen,
  onRead,
  renderItem,
}: {
  items: FeedItem[];
  groups: ReleaseGroup[];
  separate: boolean;
  open: string[];
  onOpen: (key: string, expanded: boolean) => void;
  onRead: (index: number) => void;
  renderItem: (item: FeedItem, index: number) => ReactNode;
}) {
  const membership = new Map<string, ReleaseGroup>();
  if (!separate)
    for (const group of groups) {
      const present = items.filter((item) => groupContainsEdition(group, item));
      if (present.length > 1)
        for (const item of present) membership.set(item.id, group);
    }
  const seen = new Set<string>();
  return (
    <div className="editorial-list">
      {items.map((item, index) => {
        const group = membership.get(item.id);
        if (!group) return renderItem(item, index);
        const key = `${group.eventId}:${group.eventVersion}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const rest = items
          .map((row, at) => ({ row, at }))
          .filter(
            ({ row }) => row.id !== item.id && membership.get(row.id) === group,
          );
        return (
          <section
            className="release-group"
            aria-label={`Same event: ${group.title}`}
            key={key}
          >
            <ReleaseGroupContext group={group} items={items} onRead={onRead} />
            {renderItem(item, index)}
            <details
              open={open.includes(key)}
              onToggle={(event) => onOpen(key, event.currentTarget.open)}
            >
              <summary>Other releases for this event ({rest.length})</summary>
              {rest.map(({ row, at }) => renderItem(row, at))}
            </details>
          </section>
        );
      })}
    </div>
  );
}
