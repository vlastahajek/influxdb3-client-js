import { Table, TypeMap, tableFromIPC } from 'apache-arrow';

import {
  FlightSqlClient,
  ClientOptions,
  createFlightSqlClient,
} from '../index';


export class ArrowFlightClient {
  static async fromOptions(options: ClientOptions): Promise<ArrowFlightClient> {
    const client = await createFlightSqlClient(options);
    return new ArrowFlightClient(client);
  }

  constructor(private readonly client: FlightSqlClient) { }


  async query<T extends TypeMap = any>(query: string): Promise<Table<T>> {
    const result = await this.client.query(query);
    return tableFromIPC(result);
  }
}
