import AdminDashboardPage from '../src/app/admin/dashboard/page';

async function main() {
  try {
    console.log('Testing AdminDashboardPage render...');
    const res = await AdminDashboardPage({
      searchParams: Promise.resolve({})
    });
    console.log('AdminDashboardPage rendered successfully!');
  } catch (err: any) {
    console.error('Error during AdminDashboardPage render:');
    console.error(err);
  }
}

main().finally(() => process.exit(0));
