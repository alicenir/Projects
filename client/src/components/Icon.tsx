function isEmoji(str: string) {
  return /^\p{Extended_Pictographic}/u.test(str);
}

function isUrl(str: string) {
  return /^https?:\/\//.test(str) || str.startsWith("/");
}

export function Icon({ icon, name, className }: { icon: string | null; name: string; className?: string }) {
  const fallback = name.slice(0, 2).toUpperCase();

  if (!icon) {
    return (
      <div className={`flex items-center justify-center font-bold text-sm ${className ?? ""}`}>
        {fallback}
      </div>
    );
  }

  if (isEmoji(icon)) {
    return <div className={`flex items-center justify-center text-2xl ${className ?? ""}`}>{icon}</div>;
  }

  if (isUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`object-contain ${className ?? ""}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // Treat as a simple-icons slug, e.g. "plex", "sonarr", "qbittorrent".
  return (
    <img
      src={`https://cdn.simpleicons.org/${icon}`}
      alt=""
      className={`object-contain ${className ?? ""}`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
