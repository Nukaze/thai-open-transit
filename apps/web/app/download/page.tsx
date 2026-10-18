// apps/web/app/download/page.tsx
export const metadata = { title: "Download dataset - Thai Open Transit" };

export default function DownloadPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Download the dataset</h1>
      <p>
        Thai Open Transit's dataset is the product - the map is a demonstration
        of it. Licensed under ODbL-1.0.
      </p>
      <ul>
        <li>
          <a href="/network.json" download>
            network.json
          </a>
        </li>
        <li>
          <a href="/network.geojson" download>
            network.geojson
          </a>
        </li>
        <li>
          <a href="/stations.csv" download>
            stations.csv
          </a>
        </li>
      </ul>
    </main>
  );
}
