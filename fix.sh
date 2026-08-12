sed -i 's@onClick={() => navigate(`/cat/${cat.id}`, { state: { cat } })}@onClick={() => setPendingNavigation({ url: `/cat/${cat.id}`, alias: cat.name || "Stray", cat })}@g' src/pages/AccountPage.tsx
