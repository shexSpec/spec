/** verifies Bag-Directed Search in algorithm.html
 */

import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.shex.Shex;
import org.apache.jena.shex.ShexSchema;
import org.apache.jena.shex.ShexStatus;
import org.apache.jena.shex.expressions.Expression;
import org.apache.jena.shex.expressions.ShapeExprRef;
import org.apache.jena.shex.expressions.TripleConstraint;
import org.apache.jena.shex.reporting.Report;
import org.apache.jena.shex.reporting.Reporter;
import org.apache.jena.shex.reporting.ShexValidationReport;
import org.apache.jena.shex.reporting.SimpleReport;
import org.apache.jena.shex.sys.ShexValidatorImpl;
import org.apache.jena.sparql.graph.GraphFactory;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

public class SosoProbe {

    private static final String BASE = "http://example.org/soso-dataset";

    private static final String SCHEMA = """
        PREFIX schema: <https://schema.org/>
        PREFIX xsd:    <http://www.w3.org/2001/XMLSchema#>

        <#SOSODataset> {
          (
            schema:creator @<#Agent> {1,2}
            |
            schema:creator @<#Agent> + ;
            schema:creator @<#OrcidPerson>
          ) ;
          (
            schema:identifier @<#DoiPropertyValue> {1,2}
            |
            schema:identifier xsd:string + ;
            schema:identifier @<#DoiPropertyValue>
          )
        }

        <#Agent> @<#Person> OR @<#Organization>

        <#Person> {
          a [schema:Person] ;
          schema:name xsd:string
        }

        <#Organization> {
          a [schema:Organization] ;
          schema:name xsd:string
        }

        <#OrcidPerson> {
          a [schema:Person] ;
          schema:name xsd:string ;
          schema:identifier /^https:\\/\\/orcid\\.org\\//
        }

        <#DoiPropertyValue> {
          a [schema:PropertyValue] ;
          schema:propertyID ["https://registry.identifiers.org/registry/doi"] ;
          schema:value /^10\\./
        }
        """;

    /** The conformant walkthrough instance from the document. */
    private static final String WALKTHROUGH_DATA = """
        PREFIX schema: <https://schema.org/>
        PREFIX ex:     <http://example.org/datasets#>

        ex:dset1 a schema:Dataset ;
            schema:creator    ex:alice ;
            schema:creator    ex:bob ;
            schema:creator    ex:noaa ;
            schema:identifier "gov.noaa.ncdc:C00861" ;
            schema:identifier ex:doi1 .

        ex:alice a schema:Person ;
            schema:name "Alice Walker" ;
            schema:identifier "https://orcid.org/0000-0002-1825-0097" .

        ex:bob a schema:Person ;
            schema:name "Bob Ferris" .

        ex:noaa a schema:Organization ;
            schema:name "NOAA National Centers for Environmental Information" .

        ex:doi1 a schema:PropertyValue ;
            schema:propertyID "https://registry.identifiers.org/registry/doi" ;
            schema:value "10.7289/V5D21VHZ" .
        """;

    private static class CountingReporter implements Reporter {
        final AtomicLong checkedMatchings;
        private ShexStatus status = ShexStatus.nonconformant;

        CountingReporter() { this(new AtomicLong()); }
        private CountingReporter(AtomicLong counter) { this.checkedMatchings = counter; }

        @Override public Report getReport() { return new SimpleReport(status, ""); }
        @Override public Reporter createRoot(Node node, ShapeExprRef expr) { return new CountingReporter(checkedMatchings); }
        @Override public Reporter createChild(Node node, Expression expr, Set<Triple> neigh) { return new CountingReporter(checkedMatchings); }
        @Override public void setReferenceTo(Report report, String additionalMessage) {}
        @Override public void setResult(ShexStatus s) { this.status = s; }
        @Override public void addInfo(String message, Object details) {}
        @Override public boolean isValidateOnly() { return true; }

        @Override
        public void informCandidateMatchingConformance(boolean isConformant,
                                                        Map<Triple, TripleConstraint> matching,
                                                        MatchingNotSatisfiedReason reasonIfNonConformant) {
            checkedMatchings.incrementAndGet();
        }
    }

    /** Blow-up family: nCreators ORCID-less Persons, nDois DOI PropertyValues (no legacy string id)
     *  - the "harvested record" failure mode: per-version DOIs accumulate, no creator carries an ORCID. */
    private static String data(int nCreators, int nDois) {
        StringBuilder sb = new StringBuilder();
        sb.append("PREFIX schema: <https://schema.org/>\n");
        sb.append("PREFIX ex:     <http://example.org/datasets#>\n\n");
        sb.append("ex:dset1 a schema:Dataset ;\n");
        for (int i = 0; i < nCreators; i++)
            sb.append("    schema:creator ex:p").append(i).append(" ;\n");
        for (int i = 0; i < nDois; i++)
            sb.append("    schema:identifier ex:d").append(i).append(" ;\n");
        sb.append("    schema:name \"probe dataset\" .\n\n");
        for (int i = 0; i < nCreators; i++)
            sb.append("ex:p").append(i).append(" a schema:Person ; schema:name \"Person ").append(i).append("\" .\n");
        for (int i = 0; i < nDois; i++)
            sb.append("ex:d").append(i).append(" a schema:PropertyValue ;\n")
              .append("    schema:propertyID \"https://registry.identifiers.org/registry/doi\" ;\n")
              .append("    schema:value \"10.5281/zenodo.10").append(i).append("\" .\n");
        return sb.toString();
    }

    private record Outcome(boolean conforms, long checkedMatchings, long elapsedMillis) {}

    private static Outcome validate(String turtle) {
        ShexSchema schema = Shex.schemaFromString(SCHEMA, BASE);
        Graph graph = GraphFactory.createDefaultGraph();
        RDFParser.create().fromString(turtle).lang(Lang.TURTLE).base(BASE).parse(graph);

        ShexValidatorImpl validator = new ShexValidatorImpl(Collections.emptyMap());
        CountingReporter reporter = new CountingReporter();
        validator.setReporter(reporter);

        long t0 = System.nanoTime();
        ShexValidationReport report = validator.validate(graph, schema,
                NodeFactory.createURI(BASE + "#SOSODataset"),
                NodeFactory.createURI("http://example.org/datasets#dset1"));
        long elapsed = (System.nanoTime() - t0) / 1_000_000;
        return new Outcome(report.conforms(), reporter.checkedMatchings.get(), elapsed);
    }

    public static void main(String[] args) {
        // JVM warm-up (JIT/class-loading), discarded.
        for (int i = 0; i < 20; i++) { validate(data(16, 16)); validate(WALKTHROUGH_DATA); }

        System.out.println("=== walkthrough instance (alice+ORCID, bob, NOAA ; legacy string id + DOI) ===");
        Outcome w = validate(WALKTHROUGH_DATA);
        System.out.printf("conforms=%b  checkedMatchings=%d  %d ms%n", w.conforms(), w.checkedMatchings(), w.elapsedMillis());

        System.out.println();
        System.out.println("=== blow-up family (ORCID-less Persons, DOI-only identifiers) ===");
        int[][] sizes = { {4,4}, {8,8}, {12,12}, {16,16}, {16,0}, {0,16}, {24,24} };
        for (int[] sz : sizes) {
            int na = sz[0], ni = sz[1];
            Outcome o = validate(data(na, ni));
            long cart = 1L << (na + ni);
            System.out.printf("nCreators=%2d nDois=%2d  cartesian2^n=%,18d  checkedMatchings=%6d  conforms=%b  %d ms%n",
                    na, ni, cart, o.checkedMatchings(), o.conforms(), o.elapsedMillis());
        }

        System.out.println();
        System.out.println("=== positive control: 2 plain creators, 1 DOI (short branches) ===");
        Outcome pos = validate(data(2, 1));
        System.out.printf("conforms=%b  checkedMatchings=%d%n", pos.conforms(), pos.checkedMatchings());
    }
}
