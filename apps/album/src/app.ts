interface Shot {
  key: string;
  url: string;
  size: number;
  date: string;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthOf(shot: Shot): string {
  return shot.date.slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTH_LABELS[Number(index) - 1] ?? "Sometime"} ${year}`;
}

function captionOf(key: string): string {
  const base = key.split("/").at(-1) ?? key;
  return base
    .replace(/\.\w+$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/-[0-9a-f]{8}$/, "")
    .replace(/[-_]+/g, " ");
}

function kilobytes(size: number): string {
  return size > 0 ? `${Math.max(1, Math.round(size / 1024))} KB` : "";
}

const album = document.getElementById("album") as HTMLElement;
const filterInput = document.getElementById("filter") as HTMLInputElement;
const count = document.getElementById("count") as HTMLElement;
const lightbox = document.getElementById("lightbox") as HTMLDialogElement;
const lightboxImage = document.getElementById("lightbox-image") as HTMLImageElement;
const lightboxKey = document.getElementById("lightbox-key") as HTMLElement;

let allShots: Array<Shot> = [];

function render(): void {
  const query = filterInput.value.trim().toLowerCase();
  const shots = allShots.filter((shot) => shot.key.toLowerCase().includes(query));
  count.textContent = `${shots.length} cliché${shots.length === 1 ? "" : "s"}`;
  album.replaceChildren();
  if (shots.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No clichés here (yet). Ouistiti ! 🐒";
    album.append(empty);
    return;
  }
  const byMonth = new Map<string, Array<Shot>>();
  for (const shot of shots) {
    const month = monthOf(shot);
    byMonth.set(month, [...(byMonth.get(month) ?? []), shot]);
  }
  for (const [month, monthShots] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const heading = document.createElement("h2");
    heading.className = "month";
    heading.innerHTML = `${monthLabel(month)} <span class="n">${monthShots.length}</span>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const shot of monthShots.sort((a, b) => b.key.localeCompare(a.key))) {
      const card = document.createElement("figure");
      card.className = "polaroid";
      const image = document.createElement("img");
      image.src = shot.url;
      image.alt = captionOf(shot.key);
      image.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.className = "caption";
      caption.textContent = captionOf(shot.key);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = [shot.date, kilobytes(shot.size)].filter(Boolean).join(" · ");
      card.append(image, caption, meta);
      card.addEventListener("click", () => {
        lightboxImage.src = shot.url;
        lightboxImage.alt = captionOf(shot.key);
        lightboxKey.textContent = shot.key;
        lightbox.dataset.url = shot.url;
        lightbox.showModal();
      });
      grid.append(card);
    }
    album.append(heading, grid);
  }
}

document.getElementById("lightbox-close")?.addEventListener("click", () => lightbox.close());
document.getElementById("lightbox-copy")?.addEventListener("click", () => {
  void navigator.clipboard.writeText(lightbox.dataset.url ?? "");
});
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
filterInput.addEventListener("input", render);

const response = await fetch("/api/shots");
const payload = (await response.json()) as { demo: boolean; shots: Array<Shot> };
allShots = payload.shots;
(document.getElementById("demo-banner") as HTMLElement).hidden = !payload.demo;
render();
