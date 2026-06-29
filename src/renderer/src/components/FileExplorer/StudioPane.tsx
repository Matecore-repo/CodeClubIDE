import { useCallback, useEffect, useRef, useState } from "react";
import { ExplorerBadge, ExplorerIcon, ExplorerItem, ExplorerLabel } from "./ExplorerItem";
import { FloatingContextMenu } from "./FloatingContextMenu";
import { ModalInput } from "../ui/ModalInput";
import { s } from "./styles";

function PersonIcon({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth={1.5}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

function PeopleIcon({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth={1.5}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface TeamMember {
  name: string;
  color?: string;
}

interface Team {
  name: string;
  members: TeamMember[];
}

export function StudioPane({
  workspacePath,
  activeColor,
}: {
  workspacePath: string;
  activeColor?: string;
}) {
  const [deviceName, setDeviceName] = useState("Guest");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [studioConfig, setStudioConfig] = useState<any>(null);
  const studioConfigRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; team: string } | null>(
    null,
  );
  const [renameTeam, setRenameTeam] = useState<string | null>(null);
  const draggedMemberRef = useRef<{ team: string; member: TeamMember } | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    studioConfigRef.current = studioConfig;
  }, [studioConfig]);

  useEffect(() => {
    window.api
      .getDeviceName()
      .then((name) => setDeviceName(name || "Guest"))
      .catch(() => setDeviceName("Guest"));
  }, []);

  useEffect(() => {
    let alive = true;
    window.api
      .readStudioConfig(workspacePath)
      .then((config: any) => {
        if (!alive) return;
        setStudioConfig(config);
        studioConfigRef.current = config;
        setTeams(Array.isArray(config?.teams) ? config.teams : []);
      })
      .catch(() => {
        if (!alive) return;
        setStudioConfig(null);
        studioConfigRef.current = null;
        setTeams([]);
      });
    return () => {
      alive = false;
    };
  }, [workspacePath]);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setActiveKey(null);
    }
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("codeclub:studio-selection-state", { detail: "" }));
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  useEffect(() => {
    const addGroup = () => {
      setTeams((current) => {
        const baseName = "New group";
        let name = baseName;
        let index = 2;
        while (current.some((team) => team.name === name)) {
          name = `${baseName} ${index}`;
          index++;
        }
        const next = [...current, { name, members: [] }];
        const nextConfig = { ...studioConfigRef.current, teams: next };
        setStudioConfig(nextConfig);
        window.api.writeStudioConfig(workspacePath, nextConfig).catch(() => {});
        return next;
      });
    };

    window.addEventListener("codeclub:studio-add-group", addGroup);
    return () => window.removeEventListener("codeclub:studio-add-group", addGroup);
  }, [workspacePath]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [contextMenu]);

  const saveTeams = useCallback(
    (next: Team[]) => {
      const nextConfig = { ...studioConfigRef.current, teams: next };
      studioConfigRef.current = nextConfig;
      setStudioConfig(nextConfig);
      window.api.writeStudioConfig(workspacePath, nextConfig).catch(() => {});
    },
    [workspacePath],
  );

  const renameTeamByName = useCallback(
    (from: string, to: string) => {
      const name = to.trim();
      if (!name || name === from) return;
      setTeams((current) => {
        if (current.some((team) => team.name === name)) return current;
        const next = current.map((team) => (team.name === from ? { ...team, name } : team));
        saveTeams(next);
        setActiveKey((key) => (key === groupKey(from) ? groupKey(name) : key));
        setExpanded((state) => {
          if (!(from in state)) return state;
          const { [from]: value, ...rest } = state;
          return { ...rest, [name]: value };
        });
        return next;
      });
    },
    [saveTeams],
  );

  const duplicateTeamByName = useCallback(
    (from: string) => {
      setTeams((current) => {
        const source = current.find((team) => team.name === from);
        if (!source) return current;
        const baseName = `${source.name} copy`;
        let name = baseName;
        let index = 2;
        while (current.some((team) => team.name === name)) {
          name = `${baseName} ${index}`;
          index++;
        }
        const next = [
          ...current,
          { name, members: source.members.map((member) => ({ ...member })) },
        ];
        saveTeams(next);
        return next;
      });
    },
    [saveTeams],
  );

  const deleteTeamByName = useCallback(
    (name: string) => {
      setTeams((current) => {
        const next = current.filter((team) => team.name !== name);
        saveTeams(next);
        return next;
      });
      setActiveKey((key) => (key === groupKey(name) ? null : key));
      setExpanded((state) => {
        const { [name]: _deleted, ...rest } = state;
        return rest;
      });
      window.dispatchEvent(new CustomEvent("codeclub:studio-selection-state", { detail: "" }));
    },
    [saveTeams],
  );

  const userColor = activeColor || "#7c5cbf";

  const assignedMemberNames = new Set(
    teams.flatMap((team) => team.members.map((member) => member.name)),
  );
  const unassignedMembers: TeamMember[] = assignedMemberNames.has(deviceName)
    ? []
    : [{ name: deviceName, color: userColor }];

  const setMemberDragImage = (event: React.DragEvent, name: string) => {
    const label = document.createElement("div");
    label.textContent = name;
    Object.assign(label.style, {
      position: "fixed",
      left: "-1000px",
      top: "-1000px",
      padding: "4px 8px",
      borderRadius: "6px",
      background: "#111111",
      color: "#f5f5f6",
      fontSize: "12px",
      border: "1px solid #252529",
      boxShadow: "0 6px 18px rgba(0,0,0,.35)",
    });
    document.body.appendChild(label);
    event.dataTransfer.setDragImage(label, 12, 14);
    dragImageRef.current = label;
  };

  const endMemberDrag = () => {
    draggedMemberRef.current = null;
    dragImageRef.current?.remove();
    dragImageRef.current = null;
  };

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const select = (key: string) => {
    setActiveKey(key);
    window.dispatchEvent(new CustomEvent("codeclub:studio-selection-state", { detail: key }));
  };
  const moveMember = (target: string) => {
    const dragged = draggedMemberRef.current;
    if (!dragged || dragged.team === target) return;
    setTeams((current) => {
      const next = current.map((team) => ({
        ...team,
        members: team.members.filter(
          (m) => !(team.name === dragged.team && m.name === dragged.member.name),
        ),
      }));
      const destination = next.find((team) => team.name === target);
      if (destination && !destination.members.some((m) => m.name === dragged.member.name)) {
        destination.members.push(dragged.member);
      }
      saveTeams(next);
      return next;
    });
    draggedMemberRef.current = null;
  };

  const groupKey = (team: string) => `team:${team}`;
  const memberKey = (team: string, name: string) => `member:${team}:${name}`;
  const unassignedMemberKey = (name: string) => `unassigned:${name}`;

  return (
    <div style={s.studioList}>
      {teams.map((team) => {
        const gk = groupKey(team.name);
        const isActive = activeKey === gk;
        return (
          <div key={team.name}>
            <ExplorerItem
              active={isActive}
              activeColor={activeColor}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({ x: event.clientX, y: event.clientY, team: team.name });
              }}
              onClick={() => {
                select(gk);
                toggle(team.name);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveMember(team.name);
              }}
            >
              <ExplorerIcon>
                <PeopleIcon size={14} />
              </ExplorerIcon>
              <ExplorerLabel>{team.name}</ExplorerLabel>
              <ExplorerBadge>{team.members.length}</ExplorerBadge>
            </ExplorerItem>
            {expanded[team.name] &&
              team.members.map((m) => {
                const mk = memberKey(team.name, m.name);
                return (
                  <ExplorerItem
                    key={m.name}
                    active={activeKey === mk}
                    activeColor={activeColor}
                    paddingLeft={24}
                    onClick={() => select(mk)}
                    draggable
                    onDragStart={(event) => {
                      draggedMemberRef.current = { team: team.name, member: m };
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", m.name);
                      setMemberDragImage(event, m.name);
                    }}
                    onDragEnd={endMemberDrag}
                  >
                    <ExplorerIcon>
                      <PersonIcon size={14} color={m.color} />
                    </ExplorerIcon>
                    <ExplorerLabel>{m.name}</ExplorerLabel>
                  </ExplorerItem>
                );
              })}
          </div>
        );
      })}

      {/* Unassigned */}
      {(() => {
        const ugk = "group:unassigned";
        return (
          <div>
            <ExplorerItem
              active={activeKey === ugk}
              activeColor={activeColor}
              onClick={() => {
                setActiveKey(ugk);
                window.dispatchEvent(
                  new CustomEvent("codeclub:studio-selection-state", { detail: "" }),
                );
                toggle("unassigned");
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveMember("unassigned");
              }}
            >
              <ExplorerIcon>
                <PeopleIcon size={14} />
              </ExplorerIcon>
              <ExplorerLabel>Unassigned</ExplorerLabel>
              <ExplorerBadge>{unassignedMembers.length}</ExplorerBadge>
            </ExplorerItem>
            {expanded["unassigned"] &&
              unassignedMembers.map((m) => {
                const mk = unassignedMemberKey(m.name);
                return (
                  <ExplorerItem
                    key={m.name}
                    active={activeKey === mk}
                    activeColor={activeColor}
                    paddingLeft={24}
                    onClick={() => {
                      setActiveKey(mk);
                      window.dispatchEvent(
                        new CustomEvent("codeclub:studio-selection-state", { detail: "" }),
                      );
                    }}
                    draggable
                    onDragStart={(event) => {
                      draggedMemberRef.current = { team: "unassigned", member: m };
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", m.name);
                      setMemberDragImage(event, m.name);
                    }}
                    onDragEnd={endMemberDrag}
                  >
                    <ExplorerIcon>
                      <PersonIcon size={14} color={m.color || userColor} />
                    </ExplorerIcon>
                    <ExplorerLabel>{m.name}</ExplorerLabel>
                  </ExplorerItem>
                );
              })}
          </div>
        );
      })()}
      {contextMenu && (
        <FloatingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: "Rename",
              onClick: () => {
                setRenameTeam(contextMenu.team);
                setContextMenu(null);
              },
            },
            {
              label: "Duplicate",
              onClick: () => {
                duplicateTeamByName(contextMenu.team);
                setContextMenu(null);
              },
            },
            { separator: true },
            {
              label: "Delete",
              onClick: () => {
                deleteTeamByName(contextMenu.team);
                setContextMenu(null);
              },
            },
          ]}
        />
      )}
      {renameTeam && (
        <ModalInput
          title="Rename group"
          placeholder="Group name"
          initialValue={renameTeam}
          onSubmit={(name) => {
            renameTeamByName(renameTeam, name);
            setRenameTeam(null);
          }}
          onCancel={() => setRenameTeam(null)}
        />
      )}
    </div>
  );
}
