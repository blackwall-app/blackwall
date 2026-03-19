import type { AnchorProps } from "@solidjs/router";
import type { Row, RowData, Table, TableFeature } from "@tanstack/solid-table";

export type LinkRow = {
  linkProps?: AnchorProps;
};

export type LinkOptions = {
  getLinkProps?: (row: Row<any>) => AnchorProps;
};

declare module "@tanstack/solid-table" {
  interface TableOptionsResolved<TData extends RowData> extends LinkOptions {}
  interface Row<TData extends RowData> extends LinkRow {}
}

export const LinkFeature: TableFeature<any> = {
  getDefaultOptions: <TData extends RowData>(table: Table<TData>): LinkOptions => {
    return {
      getLinkProps: undefined,
    };
  },
  createRow: <TData extends RowData>(row: Row<any>, table: Table<any>): void => {
    const linkProps = table.options.getLinkProps?.(row);

    if (!linkProps) {
      return;
    }

    row.linkProps = linkProps;
  },
};
