'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { INCLUDE_DOCUMENT_READINESS } from '@/app/lib/api/project-documents';
import { deleteProject, getClient, getProjects } from '@/app/lib/api/projects';
import {
  PROJECT_MOVED_PARAM,
  PROJECT_SHELL_COPY,
  PROJECT_STATUSES,
  ROUTES,
  projectsLabel,
} from '@/app/lib/constants';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import Pager from '@/app/ui/inventory/pager';
import { searchClients } from '@/app/ui/projects/pickers';
import { projectErrorMessage } from '@/app/ui/projects/project-lock-context';
import ProjectListTable from '@/app/ui/projects/project-list-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';
import { useToast } from '@/app/ui/toast';

/** The project portfolio (spec US3). */
export default function PortfolioPage() {
  // FR-028's other half: the project shell redirects here when a company switch leaves a reader on
  // a project belonging to the company they have just left, and this is where the explanation
  // lands. Read from the URL rather than from state, because a redirect discards state and a
  // reader who reloads what they landed on should still be told why they are here.
  const movedCompany =
    useSearchParams().get(PROJECT_MOVED_PARAM) !== null;

  // 036 I23: search, filters and page in the URL (Back from a project returns to the same page of
  // the same filter), the search debounced, the previous page kept on screen while the next loads.
  const [filters, setFilters, query] = useUrlState(
    {
      q: urlString(),
      status: urlString(),
      client: urlString(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  const toast = useToast();
  const queryClient = useQueryClient();

  const portfolio = useQuery({
    queryKey: ['projects', 'portfolio', query],
    // `include=documentReadiness` attaches each project's paperwork state to its row
    // (017 FR-008), in ONE request for the whole page. Asking per row is the N+1 the
    // backend's batch form exists to prevent — quickstart Pass 7 counts the requests.
    queryFn: () =>
      getProjects({
        search: query.q || undefined,
        status: query.status || undefined,
        clientId: query.client || undefined,
        page: query.page,
        include: INCLUDE_DOCUMENT_READINESS,
      }),
    placeholderData: keepPreviousData,
  });
  const data = portfolio.data;

  // The filter's chosen client, by id, so a filtered link opened cold still names it. Its own key:
  // the filter searches *all* clients, the project form *active* ones (036 I21).
  const filterClient = useQuery({
    queryKey: ['projects', 'clients', 'one', query.client],
    queryFn: () => getClient(query.client),
    enabled: Boolean(query.client),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      toast.success('Project deleted.');
      queryClient.invalidateQueries({ queryKey: ['projects', 'portfolio'] });
      // The client list carries a projectCount that has just changed.
      queryClient.invalidateQueries({ queryKey: ['projects', 'clients'] });
    },
    // The server's own sentence for a 409 (it names what is in the way) and the lock sentence
    // for a 423, as a toast rather than a banner that outlives the row it was about.
    onError: (error: unknown) =>
      toast.error(projectErrorMessage(error, 'The project could not be deleted.')),
  });

  const filtered =
    filters.q !== '' || filters.status !== '' || filters.client !== '';

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Portfolio" />
        <Link
          href={ROUTES.projectsNewProject}
          className="flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Add project
        </Link>
      </div>

      {movedCompany && (
        <p
          role="status"
          className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900"
        >
          {PROJECT_SHELL_COPY.otherCompanyExplanation}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField
          id="project-search"
          label="Search"
          placeholder="Project name or code"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <SelectField
          id="project-status-filter"
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectsLabel(value)}
            </option>
          ))}
        </SelectField>
        <div>
          <label
            htmlFor="project-client-filter"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Client
          </label>
          {/* 036 I22: searched on the server, not the first 200 clients. */}
          <AsyncSelect
            id="project-client-filter"
            value={filters.client}
            onChange={(id) => setFilters({ client: id })}
            search={searchClients()}
            cacheKey={['projects', 'clients', 'picker', 'all']}
            emptyLabel="All clients"
            selectedOption={
              filterClient.data && filterClient.data.id === filters.client
                ? { id: filterClient.data.id, label: filterClient.data.name }
                : null
            }
            placeholder="All clients"
          />
        </div>
      </div>

      {filtered && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setFilters({ q: '', status: '', client: '' })}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <ProjectListTable
        rows={data?.items ?? []}
        isLoading={portfolio.isLoading}
        error={portfolio.isError ? portfolio.error : null}
        onRetry={portfolio.refetch}
        filtered={filtered}
        isRefreshing={portfolio.isPlaceholderData}
        deletingId={removal.isPending ? removal.variables : null}
        onDelete={(id) => removal.mutate(id)}
      />

      {data && (
        <div className="mt-4">
          <Pager
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            onPageChange={(page) => setFilters({ page })}
            noun="project"
          />
        </div>
      )}
    </main>
  );
}
