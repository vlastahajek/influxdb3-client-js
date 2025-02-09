import { Type as ArrowType} from 'apache-arrow'
import QueryApi from '../QueryApi'
import {ConnectionOptions, QueryOptions} from '../options'
import {PointFieldType, PointValues} from '../PointValues'
import {impl, QueryProvider} from "./implSelector";


export default class QueryApiImpl implements QueryApi {
  private _queryProvider: QueryProvider

  constructor(private _options: ConnectionOptions)  {
    this._queryProvider = impl.queryProvider(this._options)
  }

  async *query(
    query: string,
    database: string,
    options: QueryOptions
  ): AsyncGenerator<Record<string, any>, void, void> {
    const batches = this._queryProvider.queryRawBatches(query, database, options)
    const start = Date.now();
    for await (const batch of batches) {
      const row: Record<string, any> = {}
      for (const batchRow of batch) {
        for (const column of batch.schema.fields) {
          row[column.name] = batchRow[column.name]
        }
        yield row
      }
    }
    const end = Date.now();
    console.log(`query response time: ${end - start}ms`);
  }


  async *queryPoints(
    query: string,
    database: string,
    options: QueryOptions
  ): AsyncGenerator<PointValues, void, void> {
    const batches = this._queryProvider.queryRawBatches(query, database, options)

    for await (const batch of batches) {
      for (let rowIndex = 0; rowIndex < batch.numRows; rowIndex++) {
        const values = new PointValues()
        for (let columnIndex = 0; columnIndex < batch.numCols; columnIndex++) {
          const columnSchema = batch.schema.fields[columnIndex]
          const name = columnSchema.name
          const value = batch.getChildAt(columnIndex)?.get(rowIndex)
          const arrowTypeId = columnSchema.typeId
          const metaType = columnSchema.metadata.get('iox::column::type')

          if (value === undefined || value === null) continue

          if (
            (name === 'measurement' || name == 'iox::measurement') &&
            typeof value === 'string'
          ) {
            values.setMeasurement(value)
            continue
          }

          if (!metaType) {
            if (name === 'time' && arrowTypeId === ArrowType.Timestamp) {
              values.setTimestamp(value)
            } else {
              values.setField(name, value)
            }

            continue
          }

          const [, , valueType, _fieldType] = metaType.split('::')

          if (valueType === 'field') {
            if (_fieldType && value !== undefined && value !== null)
              values.setField(name, value, _fieldType as PointFieldType)
          } else if (valueType === 'tag') {
            values.setTag(name, value)
          } else if (valueType === 'timestamp') {
            values.setTimestamp(value)
          }
        }

        yield values
      }
    }
  }

  async close(): Promise<void> {
    //this._closed = true
    //this._transport.close?.()
  }
}
